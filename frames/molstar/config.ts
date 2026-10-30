import type { FrameOption, ToolbarItem } from "../../lib/registry.ts";

/** Mono wordmark in the header, the way framejs.io shows "js". */
export const wordmark = "mol*";

/**
 * A subset of Mol*'s viewer options, the ones worth exposing. They are merged
 * over DEFAULT_VIEWER_OPTIONS in the island, which keeps the chrome-free
 * embedded look the existing metaframe has.
 */
export const options: FrameOption[] = [
  {
    name: "layoutShowControls",
    displayName: "Show Mol* controls",
    type: "boolean",
    default: false,
  },
  {
    name: "layoutShowSequence",
    displayName: "Show sequence",
    type: "boolean",
    default: false,
  },
  {
    name: "layoutShowLog",
    displayName: "Show log",
    type: "boolean",
    default: false,
  },
  {
    name: "viewportShowExpand",
    displayName: "Show expand button",
    type: "boolean",
    default: false,
  },
  {
    name: "pdbProvider",
    displayName: "PDB provider",
    type: "option",
    options: ["rcsb", "pdbe"],
    default: "rcsb",
  },
];

export const toolbar: ToolbarItem[] = [];
