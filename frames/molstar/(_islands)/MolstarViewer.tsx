import { useEffect, useRef, useState } from "preact/hooks";
import { FrameShell } from "../../../components/FrameShell.tsx";
import type { HelpConfig } from "../../../lib/help.ts";
import {
  useHashParam,
  useHashParamJson,
} from "../../../lib/hash/useHashParam.ts";
import { useMetaframeInputs } from "../../../lib/metaframe/useMetaframe.ts";
import { loadScriptOnce, loadStylesheetOnce } from "../../../lib/cdn.ts";
import { options as optionsSchema, toolbar, wordmark } from "../config.ts";

// Mol* is loaded dynamically and ships no types we use here.
// deno-lint-ignore no-explicit-any
type Any = any;

/**
 * The chrome-free embedded look the existing metaframe has. A frame's
 * `options` are merged over these, so a setting only has to name what it
 * changes.
 */
const DEFAULT_VIEWER_OPTIONS = {
  hideControls: true,
  layoutIsExpanded: false,
  layoutShowControls: false,
  layoutShowRemoteState: false,
  layoutShowSequence: false,
  layoutShowLog: false,
  layoutShowLeftPanel: false,
  viewportShowExpand: false,
  viewportShowSelectionMode: false,
  viewportShowAnimation: false,
  pdbProvider: "rcsb",
  emdbProvider: "rcsb",
};

/**
 * Mol*'s browser build, loaded at runtime.
 *
 * NOT `molstar/lib/apps/viewer/app.js`: that entry imports node:crypto,
 * node:fs and node:path, so it cannot be bundled for a browser — it fails at
 * load with "Failed to fetch dynamically imported module". `build/viewer` is
 * the self-contained IIFE molstar's own embedded.html uses, and fetching it at
 * runtime also keeps ~5MB out of the frame's first load.
 */
const MOLSTAR_VERSION = "5.3.0";
const MOLSTAR_BASE =
  `https://cdn.jsdelivr.net/npm/molstar@${MOLSTAR_VERSION}/build/viewer`;

let viewerModule: Promise<Any> | undefined;

function loadMolstar(): Promise<Any> {
  if (!viewerModule) {
    viewerModule = (async () => {
      loadStylesheetOnce(`${MOLSTAR_BASE}/molstar.css`);
      await loadScriptOnce(`${MOLSTAR_BASE}/molstar.js`);
      const Viewer = (globalThis as Any).molstar?.Viewer;
      if (!Viewer) throw new Error("Mol* loaded but exposed no Viewer");
      return Viewer;
    })();
  }
  return viewerModule;
}

/**
 * A metaframe value may be a dataref — `{type: "url", value}` — rather than the
 * data itself. Fetch those; pass anything else through.
 */
async function resolveDataref(value: Any): Promise<Any> {
  if (
    !value || typeof value !== "object" || value.type !== "url" ||
    typeof value.value !== "string"
  ) {
    return value;
  }
  const response = await fetch(value.value);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${value.value}: ${response.statusText}`);
  }
  // Binary formats (xtc, gro) have to stay binary; text formats (pdb, cif) are
  // handed to Mol* as strings.
  const contentType = response.headers.get("content-type") ?? "";
  return contentType.includes("application/octet-stream") ||
      contentType.includes("binary")
    ? await response.blob()
    : await response.text();
}

/**
 * What the viewer looks like, as opposed to what it is showing: panel layout,
 * renderer settings, camera. Kept in its own `view` hash param so changing the
 * camera never touches the structure or the settings blob.
 *
 * Only these three. Mol*'s full `plugin.state.getSnapshot()` is ~15 KB of JSON
 * for even a small structure — about 37 KB once base64'd into a hash, growing
 * with the structure — so it cannot live in a URL. Layout is ~170 bytes, the
 * camera ~300, and renderer settings are stored as a diff from the defaults,
 * which is usually a few hundred.
 */
interface ViewState {
  layout?: Record<string, unknown>;
  camera?: Record<string, unknown>;
  canvas3d?: Record<string, unknown>;
}

/** How long to wait after the last change before writing the view to the URL. */
const VIEW_COMMIT_DEBOUNCE_MS = 800;

/**
 * How often to check the viewer for changes it did not announce. Mol* has no
 * single observable covering its UI state — `layout.events.updated` stays
 * silent through `layout.setProps` — so the view is compared on a timer as
 * well as on its events.
 */
const VIEW_POLL_MS = 1500;

/** Only what differs from `base`, recursively. Undefined when nothing does. */
function diffFrom(current: Any, base: Any): Any {
  const plain = (v: Any) =>
    typeof v === "object" && v !== null && !Array.isArray(v);
  if (!plain(current) || !plain(base)) {
    return JSON.stringify(current) === JSON.stringify(base)
      ? undefined
      : current;
  }
  const out: Record<string, unknown> = {};
  let changed = false;
  for (const key of Object.keys(current)) {
    const d = diffFrom(current[key], base[key]);
    if (d !== undefined) {
      out[key] = d;
      changed = true;
    }
  }
  return changed ? out : undefined;
}

/** What to show. One shape per way a structure can arrive. */
type Source =
  | { kind: "pdb-id"; id: string }
  | { kind: "pdb"; data: string }
  | { kind: "cif"; data: string }
  | { kind: "trajectory"; xtc: Blob; gro: Blob };

const PDB_ID_KEYS = ["pdb-id", "pdbid", "pdbId", "pdbID"];

/**
 * Pick the structure to show, in the priority order the existing metaframe
 * uses: a PDB id beats a .pdb file, which beats a .cif, which beats a
 * trajectory pair.
 */
async function resolveSource(
  inputs: Record<string, unknown>,
): Promise<Source | undefined> {
  const keys = Object.keys(inputs ?? {});
  if (keys.length === 0) return undefined;

  for (const key of keys) {
    if (!PDB_ID_KEYS.includes(key)) continue;
    const value = await resolveDataref(inputs[key]);
    if (typeof value === "string") return { kind: "pdb-id", id: value };
  }
  for (const key of keys) {
    if (!key.endsWith(".pdb")) continue;
    const value = await resolveDataref(inputs[key]);
    if (typeof value === "string") return { kind: "pdb", data: value };
  }
  for (const key of keys) {
    if (!key.endsWith(".cif")) continue;
    const value = await resolveDataref(inputs[key]);
    if (typeof value === "string") return { kind: "cif", data: value };
  }

  const xtcKey = keys.find((k) => k.endsWith(".xtc"));
  const groKey = keys.find((k) => k.endsWith(".gro"));
  if (xtcKey && groKey) {
    const [xtc, gro] = await Promise.all([
      resolveDataref(inputs[xtcKey]),
      resolveDataref(inputs[groKey]),
    ]);
    if (xtc && gro) {
      return {
        kind: "trajectory",
        xtc: xtc instanceof Blob ? xtc : new Blob([xtc]),
        gro: gro instanceof Blob ? gro : new Blob([gro]),
      };
    }
  }
  return undefined;
}

/**
 * Restore the saved view onto a freshly built viewer, then keep the URL in step
 * with what the user does to it. Returns an unsubscribe.
 *
 * Mol* exposes everything needed directly on the plugin — `layout.setProps`,
 * `canvas3d.setProps`, `camera.setState`, and observables for layout and draw
 * — so no plugin extension or fork is required.
 */
function syncView(
  viewer: Any,
  viewRef: { current: ViewState },
  setViewRef: { current: (v: ViewState) => void },
): () => void {
  const plugin = viewer.plugin;
  const canvas3d = plugin?.canvas3d;
  if (!plugin || !canvas3d) return () => {};

  // The renderer's settings as created, so only deliberate changes are stored.
  const defaultCanvas3dProps = JSON.parse(JSON.stringify(canvas3d.props));

  // Applying the saved view moves the camera and the layout, which would
  // otherwise read as user changes and be written straight back.
  let applying = true;
  const saved = viewRef.current ?? {};
  try {
    if (saved.layout) plugin.layout.setProps(saved.layout);
    if (saved.canvas3d) canvas3d.setProps(saved.canvas3d);
    if (saved.camera) canvas3d.camera.setState(saved.camera);
  } catch (err) {
    console.error("Could not restore the saved Mol* view", err);
  }

  let timer: ReturnType<typeof setTimeout> | undefined;
  /**
   * The view as it stands with nothing touched. Compared against, so a frame
   * that is merely looked at keeps its clean URL — only a deliberate change
   * adds `view` to it.
   */
  let lastWritten: string | undefined;

  const currentView = (): ViewState | undefined => {
    try {
      const next: ViewState = {
        layout: JSON.parse(JSON.stringify(plugin.layout.state)),
        camera: JSON.parse(JSON.stringify(canvas3d.camera.getSnapshot())),
      };
      const changed = diffFrom(canvas3d.props, defaultCanvas3dProps);
      if (changed) next.canvas3d = changed;
      return next;
    } catch (err) {
      console.error("Could not read the Mol* view", err);
      return undefined;
    }
  };

  const persist = () => {
    if (applying) return;
    const next = currentView();
    if (!next) return;
    const serialized = JSON.stringify(next);
    if (serialized === lastWritten) return;
    lastWritten = serialized;
    setViewRef.current(next);
  };

  const schedule = () => {
    clearTimeout(timer);
    timer = setTimeout(persist, VIEW_COMMIT_DEBOUNCE_MS);
  };

  // These are hints that something may have changed, not a complete account
  // of it: `layout.events.updated` does not fire for `layout.setProps`, so
  // panel changes would otherwise go unnoticed until the next redraw. The
  // interval is the backstop — persist() compares before writing, so a viewer
  // nobody is touching costs one small JSON.stringify per tick and writes
  // nothing.
  const subs = [
    canvas3d.didDraw?.subscribe?.(schedule),
    plugin.layout?.events?.updated?.subscribe?.(schedule),
  ];
  const poll = setInterval(schedule, VIEW_POLL_MS);

  // Let the restore settle, then take that as the baseline: the camera drifts
  // slightly while a structure is framed, and none of that is a user decision.
  const settle = setTimeout(() => {
    lastWritten = JSON.stringify(currentView());
    applying = false;
  }, VIEW_COMMIT_DEBOUNCE_MS);

  return () => {
    clearTimeout(timer);
    clearTimeout(settle);
    clearInterval(poll);
    for (const sub of subs) sub?.unsubscribe?.();
  };
}

export function MolstarViewer({ help }: { help: HelpConfig }) {
  const [viewOptions] = useHashParamJson<Record<string, unknown>>(
    "options",
    {},
  );
  // A PDB id straight from the URL, so the frame is useful with no upstream.
  const [pdbIdParam] = useHashParam("pdbId");
  // The saved look of the viewer. Read through a ref inside the effect below:
  // as a dependency it would rebuild the viewer on every camera move.
  const [view, setView] = useHashParamJson<ViewState>("view", {});
  const viewRef = useRef(view);
  viewRef.current = view;
  const setViewRef = useRef(setView);
  setViewRef.current = setView;
  const metaframeInputs = useMetaframeInputs();

  /**
   * Mol* takes ownership of this node, so it is held in state rather than a
   * ref: if the node were ever replaced the effect below must run again and
   * rebuild the viewer. See the README's rule for frames that hand their node
   * to something else.
   */
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const [source, setSource] = useState<Source | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const viewerRef = useRef<Any>(null);

  // Inputs change -> decide what to show. Debounced: a metapage often delivers
  // several inputs in quick succession and only the final set matters.
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      resolveSource(metaframeInputs as Record<string, unknown>)
        .then((next) => {
          if (cancelled) return;
          setError(null);
          // Fall back to the URL's pdbId when nothing arrived over the wire.
          setSource(
            next ??
              (pdbIdParam ? { kind: "pdb-id", id: pdbIdParam } : undefined),
          );
        })
        .catch((err) => !cancelled && setError(String(err)));
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [metaframeInputs, pdbIdParam]);

  // One effect builds the viewer and loads the structure. Mol* has no "replace
  // what is loaded" API that covers every format, so each change disposes the
  // plugin and makes a new one — which is also why `container` has to be a
  // dependency rather than a ref read.
  useEffect(() => {
    if (!container || !source) return;
    let cancelled = false;
    const objectUrls: string[] = [];
    let subscriptions: (() => void) | undefined;
    setLoading(true);

    (async () => {
      try {
        const Viewer = await loadMolstar();
        if (cancelled) return;

        viewerRef.current?.plugin?.dispose();
        // Exposed for debugging and for anything that wants to drive the
        // viewer directly, the way the pyodide frame exposes its runtime.
        (globalThis as Any).molstarViewer = undefined;
        viewerRef.current = await Viewer.create(container, {
          ...DEFAULT_VIEWER_OPTIONS,
          ...viewOptions,
        });
        if (cancelled) return;
        const viewer = viewerRef.current;
        (globalThis as Any).molstarViewer = viewer;

        const objectUrl = (blob: Blob) => {
          const url = URL.createObjectURL(blob);
          objectUrls.push(url);
          return url;
        };

        switch (source.kind) {
          case "pdb-id":
            await viewer.loadPdb(source.id);
            break;
          case "pdb":
            await viewer.loadStructureFromUrl(
              objectUrl(new Blob([source.data], { type: "text/plain" })),
              "pdb",
            );
            break;
          case "cif":
            await viewer.loadStructureFromUrl(
              objectUrl(new Blob([source.data], { type: "text/plain" })),
              "mmcif",
            );
            break;
          case "trajectory":
            await viewer.loadTrajectory({
              model: {
                kind: "model-url",
                url: objectUrl(source.gro),
                format: "gro",
              },
              coordinates: {
                kind: "coordinates-url",
                url: objectUrl(source.xtc),
                format: "xtc",
                isBinary: true,
              },
              preset: "default",
            });
            break;
        }

        if (cancelled) return;
        subscriptions = syncView(viewer, viewRef, setViewRef);
      } catch (err) {
        if (!cancelled) setError(String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      subscriptions?.();
      for (const url of objectUrls) URL.revokeObjectURL(url);
    };
  }, [container, source, viewOptions]);

  // Dispose on unmount: Mol* holds a WebGL context, and browsers allow few.
  useEffect(() => () => viewerRef.current?.plugin?.dispose(), []);

  return (
    <FrameShell
      wordmark={wordmark}
      title="Mol* structure viewer"
      help={help}
      options={optionsSchema}
      toolbar={toolbar}
    >
      <div class="relative h-full w-full bg-surface">
        {/* Mol* owns this node and everything inside it. */}
        <div ref={setContainer} class="absolute inset-0" />

        {!source && !error && (
          <div class="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
            <p class="max-w-sm text-center text-sm text-ink-2">
              No structure yet. Connect a PDB id, a{" "}
              <span class="font-mono text-ink">.pdb</span> or{" "}
              <span class="font-mono text-ink">.cif</span>{" "}
              file, or a gromacs trajectory pair — or set{" "}
              <span class="font-mono text-ink">pdbId</span> in the URL.
            </p>
          </div>
        )}

        {loading && (
          <div class="pointer-events-none absolute left-3 top-3 flex items-center gap-2">
            <span class="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
            <span class="eyebrow">loading structure…</span>
          </div>
        )}

        {error && (
          <div class="absolute inset-x-3 top-3">
            <p class="plate border-danger/40 bg-danger-soft px-3 py-2 font-mono text-[0.8125rem] text-danger">
              {error}
            </p>
          </div>
        )}
      </div>
    </FrameShell>
  );
}
