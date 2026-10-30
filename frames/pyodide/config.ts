import type { FrameOption, ToolbarItem } from "../../lib/registry.ts";

/** Mono wordmark in the header, the way framejs.io shows "js". */
export const wordmark = "py";

export const options: FrameOption[] = [
  {
    name: "r",
    displayName: "Re-run on new inputs",
    type: "boolean",
    default: false,
  },
];

export const toolbar: ToolbarItem[] = [];
