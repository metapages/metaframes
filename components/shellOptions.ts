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
  {
    // `options.theme` is the published name and the published vocabulary —
    // "vs-dark" is a Monaco theme id that leaked into the URL format years
    // ago, and changing it now would silently reset every shared link.
    name: "theme",
    displayName: "Color scheme",
    hint:
      "Light by default rather than following the viewer's system setting: a " +
      "frame is transparent, so it has to match the page it is embedded in, " +
      "not the device. Pick System when that page follows the device too.",
    type: "option",
    options: [
      { value: "light", label: "Light (default)" },
      { value: "vs-dark", label: "Dark" },
      { value: "system", label: "System" },
    ],
    default: "light",
  },
  {
    name: "bgColor",
    displayName: "Default background color",
    hint: "Any CSS color, written without spaces. Empty leaves the frame " +
      "transparent, so whatever it is embedded in shows through.",
    type: "string",
    hashParam: true,
    /**
     * `rgb(255, 0, 0)` -> `rgb(255,0,0)`: the same colour, and the one that
     * survives the trip through the URL.
     *
     * A plain string hash param does not round-trip a space.
     * @metapages/hash-query writes the value into `location.hash` verbatim,
     * the browser percent-encodes the space on serialising the URL, and the
     * getter hands back the escape rather than the space
     * (`setHashParamInWindow("x", "light blue")` then
     * `getHashParamFromWindow("x")` === `"light blue"` is false — it is
     * `"light%20blue"`). metaframe-markdown-v2 had the same bug on the same
     * field; it is the module's to fix, and switching this one param to the
     * module's UriEncoded pair would throw on a published value containing a
     * bare `%`, such as an `hsl()` with percentages.
     *
     * Dropping the space after a comma is safe for every CSS colour syntax:
     * the comma-separated forms do not need it, and the space-separated form
     * (`rgb(255 0 0 / 50%)`) has no commas — that one is caught by the
     * validator below instead of silently doing nothing.
     */
    map: (value) =>
      typeof value === "string" ? value.replace(/,\s+/g, ",") : value,
    validator: (value) =>
      typeof value === "string" && /\s/.test(value.replace(/,\s+/g, ","))
        ? "Remove the spaces: a space in a hash param does not survive the URL."
        : undefined,
  },
  {
    name: "minimalheader",
    displayName: "Minimal header",
    // The published editor hid the close button along with the rest, which
    // left no way out of the menu at all. Close stays.
    hint: "Hides the header's buttons, leaving the wordmark and close. These " +
      "settings are then only reachable by removing minimalheader from the " +
      "URL.",
    type: "boolean",
    hashParam: true,
  },
  {
    // `modules` is the published name: the list began life in a fork of
    // metaframe-js, where the entries really were JS modules, and by the time
    // it was only ever used for stylesheets the param was already in shared
    // URLs. Entries may be bare URLs or whole `<link>` tags — both forms were
    // published — see lib/hash/useHashParamCss.ts.
    name: "modules",
    displayName: "CSS URLs",
    hint: "One stylesheet URL per line, loaded into the page.",
    type: "strings",
    hashParam: true,
  },
];
