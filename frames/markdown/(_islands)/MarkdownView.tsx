import { useEffect, useRef } from "preact/hooks";
import markdownit from "markdown-it";
import markdownItAnchor from "markdown-it-anchor";
import { FrameShell } from "../../../components/FrameShell.tsx";
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
import { options as optionsSchema } from "../options.ts";

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

export function MarkdownView({ helpUrl }: { helpUrl: string }) {
  const [markdown, setMarkdown] = useMarkdown();
  const [options] = useHashParamJson<Options>("options", {});
  const [edit, setEdit] = useHashParamBoolean("edit");
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
      root.innerHTML = renderMarkdown(markdown, options);
    } catch (err) {
      root.innerHTML = renderMarkdown(
        `# Error rendering markdown\n\n\`\`\`\n${err}\n\`\`\``,
        {},
      );
    }
    if (root.querySelector(".mermaid")) {
      ensureMermaid(options?.theme ?? "default")
        .then((m) => m.run({ querySelector: ".mermaid" }).catch(() => {}))
        .catch(() => {});
    }
  }, [markdown, options]);

  return (
    <FrameShell
      title="Markdown"
      helpUrl={helpUrl}
      mainLabel="View"
      options={optionsSchema}
    >
      <div
        class="w-full h-full flex flex-col"
        style={bgColor ? { background: bgColor } : undefined}
      >
        <div class="flex items-center gap-1 px-2 py-1 border-b border-gray-100 shrink-0">
          <button
            type="button"
            onClick={() => setEdit(edit ? undefined : true)}
            class={`px-2 py-0.5 text-sm rounded-md hover:bg-gray-100 ${
              edit ? "bg-gray-100" : ""
            }`}
            title="Toggle the markdown editor"
          >
            ✏️ Edit
          </button>
        </div>
        <div class="flex-1 min-h-0 flex">
          {edit && (
            <div
              class="min-w-0 border-r border-gray-200"
              style={{ width: editorWidth }}
            >
              <CodeMirror
                value={markdown}
                language="markdown"
                onChange={setMarkdown}
              />
            </div>
          )}
          <div class="relative flex-1 min-w-0">
            <div
              ref={rootRef}
              class="markdown-body absolute inset-0 overflow-auto p-4"
            />
          </div>
        </div>
      </div>
    </FrameShell>
  );
}
