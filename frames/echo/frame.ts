import type { FrameConfig } from "../../lib/registry.ts";
import { options } from "./options.ts";

export const frame: FrameConfig = {
  title: "Echo",
  description:
    "Sends every input straight back out as an output. For measuring data flow and debugging pipes.",
  hosts: ["echo"],
  definition: {
    version: "2",
    metadata: {
      name: "echo",
      title: "Echo",
      description:
        "Sends all inputs back as outputs. Useful for measuring data flow and debugging.",
      tags: ["debug", "passthrough", "echo"],
    },
    // Wildcard in and out: echo does not care what flows through it.
    inputs: { "*": { type: "application/octet-stream:base64" } },
    outputs: { "*": { type: "application/octet-stream:base64" } },
    hashParams: ["debug", "hm"],
  },
  options,
};
