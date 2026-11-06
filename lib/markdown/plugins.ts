// markdown-it plugins ported from metaframe-markdown-v2's worker/public/markdown-plugins.
// deno-lint-ignore-file no-explicit-any

// Turn ```mermaid fences into <div class="mermaid"> blocks. The island calls
// mermaid.run() after inserting the rendered HTML.
export function mermaidFencePlugin(md: any) {
  const defaultFence = md.renderer.rules.fence?.bind(md.renderer.rules);
  md.renderer.rules.fence = (
    tokens: any,
    idx: number,
    opts: any,
    env: any,
    self: any,
  ) => {
    const token = tokens[idx];
    if (token.info.trim() === "mermaid") {
      const code = token.content.trim();
      return `<div class="row maxWidth"><div class="mermaid row-cell standalone-image-container maxHeight">${code}</div></div>`;
    }
    return defaultFence
      ? defaultFence(tokens, idx, opts, env, self)
      : self.renderToken(tokens, idx, opts);
  };
}

interface HeadingClassOptions {
  /** Space- or comma-separated css classes to put on h1–h3. */
  h?: string;
}

const TAGGED_HEADINGS: Record<string, boolean> = {
  h1: true,
  h2: true,
  h3: true,
};

/**
 * Let h1–h3 carry custom css classes, from the `h` option.
 *
 * This is all that remains of what was `singleScreenPlugin`. Its `dm=slide`
 * presentation mode is gone: the `css` hash param (lib/hash/useHashParamCss.ts)
 * restyles a document without the renderer having to ship a second layout.
 */
export function headingClassPlugin(md: any, opts: HeadingClassOptions = {}) {
  const classes = (opts.h ?? "").replace(" ", ",").split(",").filter(Boolean);
  if (classes.length === 0) return;

  md.core.ruler.push("heading-class", (state: any) => {
    const tokens = state.tokens;
    for (let i = 0; i < tokens.length; i++) {
      const open = tokens[i - 1];
      if (
        tokens[i]?.children?.[0]?.type === "text" &&
        open?.type === "heading_open" &&
        TAGGED_HEADINGS[open.tag || ""]
      ) {
        for (const c of classes) open.attrJoin("class", c);
      }
    }
    return true;
  });
}
