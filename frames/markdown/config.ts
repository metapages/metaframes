import type { FrameOption, ToolbarItem } from "../../lib/registry.ts";

// A frame's client-shareable configuration. Imported by BOTH frame.ts (for the
// registry, which the server reads) and the frame's island (which renders it).

/** Mono wordmark in the header, the way framejs.io shows "js". */
export const wordmark = "md";

// `dm` ("display mode", with its "slide" presentation layout) was removed: the
// `css` hash param restyles a document arbitrarily, so the renderer no longer
// carries a second hard-coded layout. See lib/hash/useHashParamCss.ts.
//
// `options.theme` is NOT here: it is the frame's colour scheme, which the
// shell contributes to every frame (components/shellOptions.ts). Mermaid's own
// theme is `mermaidTheme`, so the two no longer collide — the published
// renderer only ever used `theme` for the colour scheme.
//
// `options.h` ("heading CSS classes", applied by lib/markdown/plugins.ts) is
// still honoured but has no field, which is also how it shipped: the published
// settings panel never exposed it. The "CSS URLs" setting is the general form
// of the same idea and does have one.
export const options: FrameOption[] = [
  {
    name: "mermaidTheme",
    displayName: "Mermaid theme",
    hint: "Applied to mermaid diagrams only, not to the frame itself.",
    type: "option",
    options: ["default", "neutral", "dark", "forest", "base"],
    default: "default",
  },
];

// The editor is not a toolbar item: it opens the shell's shared panel, so it
// is declared as a panel in the island (see (_islands)/MarkdownView.tsx) and
// gets its header button, its selected state and its `edit` hash param from
// the shell. Toolbar items are for plain actions like external links.
export const toolbar: ToolbarItem[] = [];
