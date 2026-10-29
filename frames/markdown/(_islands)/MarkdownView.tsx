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
  mermaidFencePlugin,
  singleScreenPlugin,
} from "../../../lib/markdown/plugins.ts";
import { options, toolbar, wordmark } from "../config.ts";

interface Options {
  dm?: string; // display mode ("slide")
  h?: string; // heading css classes
  theme?: string; // mermaid theme
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
  md.use(singleScreenPlugin, options ?? {});
  md.use(markdownItAnchor, { level: [1, 2, 3] });
  if (options?.dm === "slide") {
    md.renderer.rules.table_open = () =>
      '<div class="row"><div class="rowCellTable">\n<table>\n';
    md.renderer.rules.table_close = () => "</table>\n</div>\n</div>";
  }
  return md.render(source ?? "");
}

export function MarkdownView({ help }: { help: HelpConfig }) {
  const [markdown, setMarkdown] = useMarkdown();
  const [viewOptions] = useHashParamJson<Options>("options", {});
  const [bgColor] = useHashParam("bgColor");
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
      ensureMermaid(viewOptions?.theme ?? "default")
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
      <div
        class="h-full w-full bg-surface"
        style={bgColor ? { background: bgColor } : undefined}
      >
        <div
          ref={setRoot}
          class="markdown-body h-full overflow-auto px-6 py-5"
        />
      </div>
    </FrameShell>
  );
}
