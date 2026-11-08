import type { ComponentChildren, JSX } from "preact";
import { useCallback, useRef, useState } from "preact/hooks";
import { PanelHeader } from "./PanelHeader.tsx";

/** Neither side of the split may be dragged narrower than this. */
const MIN_PANEL_PX = 160;
const MIN_RENDERER_PX = 160;

/** Arrow-key step, and the coarse step with shift held. */
const STEP_PX = 16;
const COARSE_STEP_PX = 64;

/**
 * A dragged width only has to leave the renderer alive. Expressed in CSS as
 * well as clamped in JS, so a window resize cannot strand a stored width that
 * was legal when it was set.
 */
const MAX_WIDTH = `max(${MIN_PANEL_PX}px, calc(100% - ${MIN_RENDERER_PX}px))`;

/**
 * One key per frame, shared by every panel in it: there is one split in this
 * workbench and the viewer moved it. Keying per panel instead meant dragging
 * the settings panel wider and then reopening the editor at its default — the
 * same split, in the same place, forgetting where it was put.
 */
function storageKey(frame: string): string {
  return `mtfm:panel-width:${frame}`;
}

function readStoredWidth(frame: string, panel: string): number | null {
  try {
    const store = globalThis.localStorage;
    // The per-panel key is what the first version of this wrote; read it so a
    // width set before the split became one setting is not thrown away.
    const raw = store?.getItem(storageKey(frame)) ??
      store?.getItem(`${storageKey(frame)}:${panel}`);
    if (!raw) return null;
    const px = Number.parseFloat(raw);
    return Number.isFinite(px) && px > 0 ? px : null;
  } catch {
    // Private windows, blocked site data and cross-origin embedding all make
    // `localStorage` throw on *access*. A frame that cannot remember a width
    // still has to open.
    return null;
  }
}

function writeStoredWidth(frame: string, panel: string, px: number | null) {
  try {
    const store = globalThis.localStorage;
    const key = storageKey(frame);
    if (px === null) store?.removeItem(key);
    else store?.setItem(key, String(Math.round(px)));
    // Whatever the old per-panel key said is now stale either way.
    store?.removeItem(`${key}:${panel}`);
  } catch {
    // See above: remembering is a convenience, never a requirement.
  }
}

export interface PanelColumnProps {
  /** Namespace for the remembered width — the frame this panel belongs to. */
  frame: string;
  /** Which panel this is. Not part of the remembered width; see storageKey. */
  panelKey: string;
  label: string;
  /**
   * The width the frame declares (markdown's `editorWidth`, default `80ch`).
   * It is the starting point, not the law: the viewer's own drag outranks it.
   */
  declaredWidth?: string;
  children: ComponentChildren;
}

/**
 * The panel beside the renderer, and the handle that sets how wide it is.
 *
 * The split is adjustable by drag, by arrow key, and reset by double-click.
 * The width is **per viewer**, not part of the document: it lives in
 * `localStorage`, not in the hash, so dragging the editor wider never changes
 * the URL anyone else opens. A width the frame declares is the default until
 * the viewer moves it once, and from then on every panel in this frame — the
 * editor, the settings, the help — opens where the split was left.
 */
export function PanelColumn(
  { frame, panelKey, label, declaredWidth, children }: PanelColumnProps,
): JSX.Element {
  const asideRef = useRef<HTMLElement>(null);
  /**
   * The viewer's width for this frame's split, in px, or `null` for "use the
   * declared width". Read synchronously on mount so the panel never paints at
   * the default width and then jumps.
   */
  const [width, setWidth] = useState<number | null>(() =>
    readStoredWidth(frame, panelKey)
  );
  const [dragging, setDragging] = useState(false);

  /** Keep both sides usable, measured against the row we actually sit in. */
  const clamp = useCallback((px: number): number => {
    const row = asideRef.current?.parentElement;
    const room = row ? row.clientWidth - MIN_RENDERER_PX : px;
    return Math.max(MIN_PANEL_PX, Math.min(px, Math.max(MIN_PANEL_PX, room)));
  }, []);

  const commit = useCallback((px: number | null) => {
    setWidth(px);
    writeStoredWidth(frame, panelKey, px);
  }, [frame, panelKey]);

  const onPointerDown = useCallback(
    (event: JSX.TargetedPointerEvent<HTMLDivElement>) => {
      const aside = asideRef.current;
      if (!aside || event.button !== 0) return;
      // Stops the drag from selecting text across the whole frame.
      event.preventDefault();

      const handle = event.currentTarget;
      const startX = event.clientX;
      const startWidth = aside.offsetWidth;
      let latest = startWidth;

      // Pointer capture, so every move lands on the handle even as the cursor
      // crosses the renderer: an iframe under the pointer would otherwise
      // swallow the events and the drag would stick halfway.
      handle.setPointerCapture(event.pointerId);
      setDragging(true);

      const move = (e: PointerEvent) => {
        latest = clamp(startWidth - (e.clientX - startX));
        setWidth(latest);
      };
      const end = () => {
        handle.removeEventListener("pointermove", move);
        handle.removeEventListener("pointerup", end);
        handle.removeEventListener("pointercancel", end);
        setDragging(false);
        // Written once, at the end of the gesture, rather than on every frame.
        commit(latest);
      };

      handle.addEventListener("pointermove", move);
      handle.addEventListener("pointerup", end);
      handle.addEventListener("pointercancel", end);
    },
    [clamp, commit],
  );

  const onKeyDown = useCallback(
    (event: JSX.TargetedKeyboardEvent<HTMLDivElement>) => {
      const step = event.shiftKey ? COARSE_STEP_PX : STEP_PX;
      const current = asideRef.current?.offsetWidth ?? MIN_PANEL_PX;
      switch (event.key) {
        // The panel is on the right, so left widens it.
        case "ArrowLeft":
          event.preventDefault();
          return commit(clamp(current + step));
        case "ArrowRight":
          event.preventDefault();
          return commit(clamp(current - step));
        case "Home":
          event.preventDefault();
          return commit(null);
      }
    },
    [clamp, commit],
  );

  return (
    <aside
      ref={asideRef}
      class="relative flex min-h-0 shrink-0 flex-col border-l border-line bg-surface-2"
      style={{
        width: width === null ? declaredWidth ?? "50%" : `${width}px`,
        // A declared width is configuration and must not be able to crowd the
        // renderer out of a narrow frame; a dragged width is a deliberate act.
        maxWidth: width === null ? `min(70%, ${MAX_WIDTH})` : MAX_WIDTH,
      }}
    >
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label={`Resize the ${label} panel`}
        tabIndex={0}
        onPointerDown={onPointerDown}
        onKeyDown={onKeyDown}
        onDblClick={() => commit(null)}
        title="Drag to resize · double-click to reset"
        // Sits astride the border, a few pixels wider than it, so it can
        // actually be hit; `touch-none` keeps a touch drag from scrolling.
        class={`absolute inset-y-0 -left-[3px] z-[4] w-[7px] cursor-col-resize touch-none transition-colors hover:bg-accent/40 focus-visible:bg-accent/60 focus-visible:outline-none ${
          dragging ? "bg-accent/60" : ""
        }`}
      />
      <PanelHeader title={label} />
      <div class="min-h-0 flex-1 overflow-y-auto">{children}</div>
    </aside>
  );
}
