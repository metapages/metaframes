import type { FrameConfig } from "../../lib/registry.ts";
import { options, toolbar, wordmark } from "./config.ts";

export const frame: FrameConfig = {
  title: "Python",
  description:
    "Runs Python in the browser with Pyodide. Inputs arrive as files under /inputs; anything written to /outputs is sent on.",
  // `py` is canonical; `pyiodide` is the original (misspelled) subdomain that
  // published metapages still embed.
  hosts: ["py", "pyiodide"],
  definition: {
    version: "2",
    metadata: {
      name: "pyodide",
      title: "Python",
      description:
        "Run Python entirely in the browser and connect it to other metaframes.",
      tags: ["python", "pyodide", "compute", "wasm"],
    },
    // Wildcard: any input becomes a file under /inputs, any file written to
    // /outputs becomes an output.
    inputs: { "*": { type: "application/octet-stream:base64" } },
    outputs: { "*": { type: "application/octet-stream:base64" } },
    hashParams: ["py", "options", "edit", "editor", "hm"],
  },
  wordmark,
  options,
  toolbar,
};
