import { useEffect, useMemo, useState } from "preact/hooks";
import markdownit from "markdown-it";
import markdownItAnchor from "markdown-it-anchor";
import { FrameShell } from "../../../components/FrameShell.tsx";
import type { HelpConfig } from "../../../lib/help.ts";
import { CodeMirror } from "../../../components/CodeMirror.tsx";
import {
  useHashParam,
  useHashParamJson,
} from "../../../lib/hash/useHashParam.ts";
import { useMarkdown } from "../../../lib/markdown/useMarkdown.ts";
import {
  headingClassPlugin,
  mermaidFencePlugin,
} from "../../../lib/markdown/plugins.ts";
import { options, toolbar, wordmark } from "../config.ts";

interface Options {
  /** Heading CSS classes. No settings field; see config.ts. */
  h?: string;
  /** Mermaid's diagram theme — not the frame's colour scheme, which is
   * `theme` and belongs to the shell. */
  mermaidTheme?: string;
}

// deno-lint-ignore no-explicit-any
let mermaidLib: any = null;

/**
 * Loaded from a CDN at runtime rather than bundled: mermaid v11 pulls in
 * cytoscape-fcose, which imports a Node built-in and cannot be bundled for the
 * browser.
 */
async function ensureMermaid(theme: string) {
  if (mermaidLib) return mermaidLib;
  const mod = await import(
    /* @vite-ignore */ "https://cdn.jsdelivr.net/npm/mermaid@11.6.0/+esm"
  );
  mermaidLib = mod.default;
  mermaidLib.initialize({
    startOnLoad: false,
    securityLevel: "loose",
    theme,
    flowchart: { htmlLabels: true, useMaxWidth: true },
  });
  return mermaidLib;
}

function renderMarkdown(source: string, options: Options): string {
  const md = markdownit({ html: true, linkify: true, typographer: true });
  md.use(mermaidFencePlugin);
  md.use(headingClassPlugin, options ?? {});
  md.use(markdownItAnchor, { level: [1, 2, 3] });
  return md.render(source ?? "");
}

export function MarkdownView({ help }: { help: HelpConfig }) {
  const [markdown, setMarkdown] = useMarkdown();
  const [viewOptions] = useHashParamJson<Options>("options", {});
  // `bgColor`, `css`, `modules` and the colour scheme are the shell's — they
  // describe how any frame is presented, not what this one renders.
  const [editorWidth] = useHashParam("editorWidth", "80ch");
  // A ref *callback* into state, not useRef: the effect below writes HTML into
  // this node, so it has to re-run if the node is ever replaced. A plain ref
  // would leave the new node empty and the frame blank, with no error.
  const [root, setRoot] = useState<HTMLDivElement | null>(null);

  // Rendered HTML is injected directly rather than built as a VNode tree:
  // markdown-it emits HTML, and mermaid then mutates those nodes itself, so
  // this subtree must stay outside Preact's control.
  useEffect(() => {
    if (!root) return;
    try {
      root.innerHTML = renderMarkdown(markdown, viewOptions);
    } catch (err) {
      root.innerHTML = renderMarkdown(
        `# Error rendering markdown\n\n\`\`\`\n${err}\n\`\`\``,
        {},
      );
    }
    if (root.querySelector(".mermaid")) {
      ensureMermaid(viewOptions?.mermaidTheme ?? "default")
        .then((m) => m.run({ querySelector: ".mermaid" }).catch(() => {}))
        .catch(() => {});
    }
  }, [root, markdown, viewOptions]);

  // The editor is part of the menu, not the renderer: `edit=true` opens the
  // menu and this is the panel it lands on, so a frame without `edit` is just
  // the rendered document. The two communicate only through the `md` hash
  // param — the editor writes it, the renderer reads it.
  const panels = useMemo(() => [{
    key: "editor",
    label: "editor",
    icon: "pencil" as const,
    width: editorWidth,
    content: (
      <CodeMirror
        value={markdown}
        language="markdown"
        onChange={setMarkdown}
      />
    ),
  }], [markdown, setMarkdown, editorWidth]);

  return (
    <FrameShell
      wordmark={wordmark}
      title="Markdown"
      help={help}
      options={options}
      toolbar={toolbar}
      panels={panels}
    >
      {
        /* No background and no padding: the rendered document is transparent so
           the metapage embedding it shows through, the way the published
           renderer was, and it sits flush against the frame's edges. Inset here
           reads as mystery space in the embedding page, which cannot reach in to
           remove it — spacing belongs to whoever embeds the frame. The first and
           last block's margins are zeroed in `.markdown-body` for the same
           reason. An opaque ground is the shell's `bgColor` setting. */
      }
      <div
        ref={setRoot}
        class="markdown-body h-full w-full overflow-auto"
      />
    </FrameShell>
  );
}
