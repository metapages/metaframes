import { useEffect, useRef } from "preact/hooks";
import markdownit from "markdown-it";
import markdownItAnchor from "markdown-it-anchor";
import { FrameShell } from "../../../components/FrameShell.tsx";
import type { HelpConfig } from "../../../lib/help.ts";
import { CodeMirror } from "../../../components/CodeMirror.tsx";
import {
  useHashParam,
  useHashParamBoolean,
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
  // Written by the shell's declared `edit` toolbar toggle (see ../config.ts) —
  // this side only reads it.
  const [edit] = useHashParamBoolean("edit");
  const [bgColor] = useHashParam("bgColor");
  const [editorWidth] = useHashParam("editorWidth", "80ch");
  const rootRef = useRef<HTMLDivElement>(null);

  // Rendered HTML is injected directly rather than built as a VNode tree:
  // markdown-it emits HTML, and mermaid then mutates those nodes itself, so
  // this subtree must stay outside Preact's control.
  useEffect(() => {
    const root = rootRef.current;
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
  }, [markdown, viewOptions]);

  return (
    <FrameShell
      wordmark={wordmark}
      title="Markdown"
      help={help}
      options={options}
      toolbar={toolbar}
    >
      <div
        class="flex h-full w-full bg-surface"
        style={bgColor ? { background: bgColor } : undefined}
      >
        {edit && (
          <div
            class="min-w-0 shrink-0 border-r border-line"
            style={{ width: editorWidth }}
          >
            <CodeMirror
              value={markdown}
              language="markdown"
              onChange={setMarkdown}
            />
          </div>
        )}
        <div class="relative min-w-0 flex-1">
          <div
            ref={rootRef}
            class="markdown-body absolute inset-0 overflow-auto px-6 py-5"
          />
        </div>
      </div>
    </FrameShell>
  );
}
