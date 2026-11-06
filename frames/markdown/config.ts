import type { FrameOption, ToolbarItem } from "../../lib/registry.ts";

// A frame's client-shareable configuration. Imported by BOTH frame.ts (for the
// registry, which the server reads) and the frame's island (which renders it).

/** Mono wordmark in the header, the way framejs.io shows "js". */
export const wordmark = "md";

// `dm` ("display mode", with its "slide" presentation layout) was removed: the
// `css` hash param restyles a document arbitrarily, so the renderer no longer
// carries a second hard-coded layout. See lib/hash/useHashParamCss.ts.
export const options: FrameOption[] = [
  {
    name: "theme",
    displayName: "Mermaid theme",
    type: "option",
    options: ["default", "neutral", "dark", "forest", "base"],
    default: "default",
  },
  {
    name: "h",
    displayName: "Heading CSS classes",
    type: "string",
  },
];

// The editor is not a toolbar item: it opens the shell's shared panel, so it
// is declared as a panel in the island (see (_islands)/MarkdownView.tsx) and
// gets its header button, its selected state and its `edit` hash param from
// the shell. Toolbar items are for plain actions like external links.
export const toolbar: ToolbarItem[] = [];
