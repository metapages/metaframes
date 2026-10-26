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

interface SingleScreenOptions {
  dm?: string; // display mode; "slide" enables slide layout
  h?: string; // heading css classes
}

const CENTERED_HEADINGS: Record<string, boolean> = {
  h1: true,
  h2: true,
  h3: true,
};

// Slide/single-screen display mode: centers images, tags text, and lets
// headings carry custom css classes (from options.h).
export function singleScreenPlugin(md: any, opts: SingleScreenOptions = {}) {
  md.core.ruler.push("single-screen", (state: any) => {
    const tokens = state.tokens;
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      const child0 = token?.children?.[0];
      if (opts.dm === "slide") {
        if (child0?.type === "image" && tokens[i - 1] && tokens[i + 1]) {
          tokens[i - 1].tag = "div";
          tokens[i - 1].attrPush(["class", "standalone-image-container"]);
          tokens[i + 1].tag = "div";
        }
        if (child0?.type === "text" && tokens[i - 1]) {
          tokens[i - 1].attrPush(["class", "markdown-text"]);
        }
      }
      if (
        child0?.type === "text" &&
        tokens[i - 1] &&
        CENTERED_HEADINGS[tokens[i - 1].tag || ""] &&
        tokens[i - 1].type === "heading_open" &&
        opts.h
      ) {
        for (
          const c of opts.h.replace(" ", ",").split(",").filter(Boolean)
        ) {
          tokens[i - 1].attrJoin("class", c);
        }
      }
    }
    return true;
  });
}
