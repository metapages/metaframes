import type { FrameOption } from "../lib/registry.ts";
import { HASH_KEY_EDITOR } from "../lib/hash/useEditorMode.ts";

/**
 * Settings the shell contributes to **every** frame's settings panel, after
 * whatever that frame declares itself.
 *
 * These describe the chrome, not the document, so no frame should have to
 * declare them: a frame says what it is, and the shell says how it is framed.
 *
 * `editor` is the one the published editor had as "Button Visibility"
 * (metaframe-markdown-v2/editor/src/components/sections/settings/
 * EditButtonSettings.tsx), with the same three choices and the same default —
 * and, as there, the default is written as an *absent* param so a shared URL
 * carries only what was actually chosen.
 */
export const SHELL_OPTIONS: FrameOption[] = [
  {
    name: HASH_KEY_EDITOR,
    displayName: "Edit button",
    // The warning is the published one, from v1's own radio label: the control
    // can switch itself off, and there is no way back from inside the frame.
    hint:
      "How the menu button appears while the menu is closed. Hidden makes the " +
      "content read-only: nothing can reopen the menu without removing " +
      "editor=disabled from the URL.",
    type: "option",
    // Stored values are the published vocabulary; the labels say what they
    // actually do, since "invisible" reads like "hidden" and is not.
    options: [
      { value: "visible", label: "Always visible" },
      { value: "invisible", label: "Visible on hover (default)" },
      { value: "disabled", label: "Hidden" },
    ],
    default: "invisible",
    hashParam: true,
  },
];
