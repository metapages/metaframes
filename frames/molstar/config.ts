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
    // The structure being viewed is what the frame *is*, so it lives in its own
    // hash param (#?pdbId=1cbs) rather than inside the options blob — the same
    // shape as markdown's `md` and pyodide's `py`. Metaframe inputs still take
    // priority over it; this is the standalone fallback.
    name: "pdbId",
    displayName: "PDB id",
    type: "string",
    hashParam: true,
    validator: (value) => {
      const id = String(value).trim();
      if (!id) return undefined; // empty just means "no id"
      return /^[0-9a-z]{4}$/i.test(id)
        ? undefined
        : "A PDB id is 4 characters, e.g. 1cbs";
    },
    map: (value) => String(value).trim().toLowerCase(),
  },
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
