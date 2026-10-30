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

export function MolstarViewer({ help }: { help: HelpConfig }) {
  const [viewOptions] = useHashParamJson<Record<string, unknown>>(
    "options",
    {},
  );
  // A PDB id straight from the URL, so the frame is useful with no upstream.
  const [pdbIdParam] = useHashParam("pdbId");
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
    setLoading(true);

    (async () => {
      try {
        const Viewer = await loadMolstar();
        if (cancelled) return;

        viewerRef.current?.plugin?.dispose();
        viewerRef.current = await Viewer.create(container, {
          ...DEFAULT_VIEWER_OPTIONS,
          ...viewOptions,
        });
        if (cancelled) return;
        const viewer = viewerRef.current;

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
      } catch (err) {
        if (!cancelled) setError(String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
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
