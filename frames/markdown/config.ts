import type { FrameOption, ToolbarItem } from "../../lib/registry.ts";

// A frame's client-shareable configuration. Imported by BOTH frame.ts (for the
// registry, which the server reads) and the frame's island (which renders it).

/** Mono wordmark in the header, the way framejs.io shows "js". */
export const wordmark = "md";

export const options: FrameOption[] = [
  {
    name: "dm",
    displayName: "Display mode",
    type: "option",
    options: ["default", "slide"],
    default: "default",
  },
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

/**
 * The editor toggle is declared, not written: the shell turns this into a
 * header icon wired to the `edit` hash param, and the island reads the same
 * param with useHashParamBoolean. No button, no handler, no per-frame code.
 */
export const toolbar: ToolbarItem[] = [
  {
    kind: "hashParamToggle",
    param: "edit",
    label: "edit",
    icon: "pencil",
  },
];
