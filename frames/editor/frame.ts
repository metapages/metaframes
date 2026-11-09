import type { FrameConfig } from "../../lib/registry.ts";
import { options, toolbar, wordmark } from "./config.ts";

export const frame: FrameConfig = {
  title: "Editor",
  description:
    "Monaco, the editor behind VS Code, configured entirely by its URL: the document and every option travel in the hash.",
  hosts: ["editor"],
  definition: {
    version: "2",
    metadata: {
      name: "Metaframe Editor",
      title: "Text and code editor",
      author: "@dionjwa",
      description:
        "An embeddable code and text editor (Monaco, the engine behind VS Code) configured entirely by its URL. The document and every editor option are encoded in the URL hash, so one URL is a complete, shareable, embeddable editor. Embed with a single iframe: no install, no build step, no account. Docs for agents: https://editor.mtfm.io/llms.txt",
      tags: ["editor", "code", "text", "monaco", "vscode", "embeddable"],
    },
    // One pipe in, one pipe out, both named `text`. A value arriving on a
    // differently named pipe takes over both names — see the island.
    inputs: {
      text: { type: "string" },
    },
    outputs: {
      text: { type: "string" },
    },
    // Only this frame's own param. The shell's — `edit`, `editor`/`hm`,
    // `options`, `bgColor`, `minimalheader`, `css`, `modules` — are folded in
    // when the definition is served, for every frame at once
    // (SHELL_HASH_PARAMS in lib/registry.ts).
    hashParams: [
      "text",
    ],
  },
  wordmark,
  options,
  toolbar,
};
