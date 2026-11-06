import { useHashParam } from "./useHashParam.ts";

/**
 * How reachable a frame's authoring surface is. Named `editor` because that is
 * what it controls: whether the content of this frame can be edited here at
 * all, and how prominently the way in is offered.
 */
export const HASH_KEY_EDITOR = "editor";

/**
 * `hm` ("hide menu") was the published name. Every metaframe deployed so far
 * reads it, and the help convention every one of them embeds is
 * `https://markdown.mtfm.io/#?hm=disabled&url=…/README.md`, so those URLs
 * arrive here the moment this deployment takes over that host. It is read
 * forever; only `editor` is written.
 */
export const HASH_KEY_EDITOR_LEGACY = "hm";

export type EditorMode =
  /** The way into the editor is drawn at all times. */
  | "visible"
  /** Drawn on hover, always clickable. The default, and what an embed wants. */
  | "invisible"
  /** No editor and no button, ever: the content is not editable here. */
  | "disabled";

/**
 * Liberal about what it accepts, because the value comes from whatever system
 * built the URL. `editor=false` is the obvious thing for an external system to
 * write when it means "not editable", and it costs nothing to honour.
 */
export function editorModeFromValue(raw: string | undefined): EditorMode {
  switch (raw?.trim().toLowerCase()) {
    case "visible":
    case "true":
      return "visible";
    case "disabled":
    case "false":
    case "none":
      return "disabled";
    default:
      return "invisible";
  }
}

/**
 * The precedence rule, kept as a pure function so the compatibility claim is
 * covered by `just check` and not only by a browser.
 *
 * `||`, not `??`: `useHashParam` yields `""` for an absent param, so `??`
 * would never reach the legacy name and every published `hm=disabled` URL —
 * which is every frame's help iframe — would open with the menu reachable.
 */
export function editorModeFrom(
  editor: string | undefined,
  legacy: string | undefined,
): EditorMode {
  return editorModeFromValue(editor || legacy);
}

/** The editor mode from the URL, preferring `editor` over the legacy `hm`. */
export function useEditorMode(): EditorMode {
  const [editor] = useHashParam(HASH_KEY_EDITOR);
  const [legacy] = useHashParam(HASH_KEY_EDITOR_LEGACY);
  return editorModeFrom(editor, legacy);
}
