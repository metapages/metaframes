import type { FrameOption, ToolbarItem } from "../../lib/registry.ts";

// A frame's client-shareable configuration. Imported by BOTH frame.ts (for the
// registry, which the server reads) and the frame's island (which renders it).
// It cannot be passed from the route into the island as a prop: `options` may
// carry `validator`/`map` functions, which do not survive island prop
// serialization.

/** Mono wordmark in the header, the way framejs.io shows "js". */
export const wordmark = "echo";

export const options: FrameOption[] = [
  {
    name: "debug",
    displayName: "Show inputs as JSON",
    type: "boolean",
    default: false,
  },
];

export const toolbar: ToolbarItem[] = [];
