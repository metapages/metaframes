import type { FrameConfig } from "../../lib/registry.ts";
import { options, toolbar, wordmark } from "./config.ts";

const MARKDOWN = "text/markdown; charset=UTF-8";

export const frame: FrameConfig = {
  title: "Markdown",
  description:
    "Renders markdown (with mermaid diagrams and heading anchors) from the URL, with an optional live editor.",
  // markdownv2 is a legacy alias: published metapages embed it and must keep
  // resolving here.
  hosts: ["markdown", "markdownv2"],
  definition: {
    version: "2",
    metadata: {
      name: "markdown",
      title: "markdown-it",
      author: "@dionjwa",
      description: "Markdown renderer, with mermaid support",
      tags: ["markdown", "mermaid", "docs", "renderer"],
    },
    inputs: {
      markdown: { type: MARKDOWN },
      md: { type: MARKDOWN },
      "markdown-base64": { type: MARKDOWN },
      "md-base64": { type: MARKDOWN },
      mermaid: { type: "text/vnd.mermaid" },
      "mermaid-base64": { type: "text/vnd.mermaid" },
    },
    outputs: {
      // Mermaid nodes can declare click handlers; the clicked text comes out here.
      click: { type: "string" },
    },
    hashParams: [
      "md",
      "base64",
      "url",
      "edit",
      "options",
      // Transient styling: restyles the render without touching the content.
      "css",
      "bgColor",
      "editorWidth",
      // How reachable the editor is. `hm` is the published name for the same
      // thing and is still read, so both are declared.
      "editor",
      "hm",
    ],
  },
  wordmark,
  options,
  toolbar,
};
