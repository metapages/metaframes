import { useCallback, useEffect, useRef } from "preact/hooks";
import {
  setHashParamInWindow,
  stringFromBase64String,
} from "@metapages/hash-query";
import { useHashParam, useHashParamBase64 } from "../hash/useHashParam.ts";
import { useHashParamDocument } from "../hash/useHashParamDocument.ts";
import { useMetaframe } from "../metaframe/useMetaframe.ts";

// Hash param keys, unchanged from the deployed markdown metaframe: `base64`
// was the original name for the content param and published URLs still use it.
export const HashKeyMarkdown = "md";
export const HashKeyMarkdownLegacy = "base64";
export const HashKeyUrl = "url";

/**
 * Metaframe inputs can arrive base64-encoded. Decoding goes through
 * @metapages/hash-query, which owns the encoding (`btoa(encodeURIComponent(s))`
 * — bare `atob`/`btoa` throws on non-Latin1 text and corrupts `%`).
 */
const decodeMarkdown = (b64: string): string => stringFromBase64String(b64);

/** Rewrite relative image references so they resolve against the fetched doc. */
function absolutizeImages(markdown: string, docUrl: string): string {
  const origin = new URL(docUrl).origin;
  const dir = docUrl.substring(0, docUrl.lastIndexOf("/"));
  const absolute = (path: string) =>
    path.startsWith("/") ? `${origin}${path}` : `${dir}/${path}`;

  return markdown
    .replace(
      /!\[([^\]]*)\]\((?!http|https)([^)]+)\)/g,
      (_m, alt, path) => `![${alt}](${absolute(path)})`,
    )
    .replace(
      /<img\s+[^>]*src=["'](?!http|https)([^"']+)["'][^>]*>/g,
      (m, path) => m.replace(path, absolute(path)),
    );
}

/**
 * The markdown document to render, and a setter that persists it.
 *
 * Sources, in the order the deployed metaframe resolves them: metaframe inputs
 * (`markdown` / `md` / `markdown-base64` / `md-base64` / `mermaid` /
 * `mermaid-base64`), a `url` hash param fetched over CORS, or the `md` /
 * legacy `base64` hash param.
 */
export function useMarkdown(): [string, (markdown: string) => void] {
  const metaframe = useMetaframe();
  const [url] = useHashParam(HashKeyUrl);
  // The live document: renders immediately, reaches the hash once typing
  // pauses, and ignores its own write coming back. Shared with every other
  // frame that has an editor.
  const doc = useHashParamDocument(HashKeyMarkdown);
  const [fromHashLegacy] = useHashParamBase64(HashKeyMarkdownLegacy);

  const markdown = doc.value;
  const fromUrlRef = useRef<string | undefined>(undefined);
  const previousInputRef = useRef<string | undefined>(undefined);

  /** A metaframe input arrived: show it, but do not write it back. */
  const setIfNew = useCallback((next: string) => {
    if (previousInputRef.current === next) return;
    previousInputRef.current = next;
    doc.replace(next);
  }, [doc.replace]);

  /** Edited here. Writing content invalidates any `url` param. */
  const setMarkdownAndPersist = useCallback((next: string) => {
    if (fromUrlRef.current === next) return;
    doc.edit(next);
    setHashParamInWindow(HashKeyUrl, undefined);
  }, [doc.edit]);

  // Metaframe inputs.
  useEffect(() => {
    if (!metaframe) return;

    // Mermaid diagrams can declare click handlers that call this.
    (globalThis as unknown as Record<string, unknown>).handleClick = (
      nodeClickText: string,
    ) => metaframe.setOutput("click", nodeClickText);

    return metaframe.onInputs((inputs) => {
      if (!inputs) return;

      if (inputs["markdown"]) return setIfNew(inputs["markdown"]);
      if (inputs["md"]) return setIfNew(inputs["md"]);

      const b64 = inputs["markdown-base64"] || inputs["md-base64"];
      if (b64) {
        const key = inputs["markdown-base64"] ? "markdown-base64" : "md-base64";
        try {
          return setIfNew(decodeMarkdown(b64));
        } catch (err) {
          return setIfNew(
            `# Error decoding base64 metaframe input\n\n - key: "${key}"\n - value: ${b64}\n - err: ${err}`,
          );
        }
      }

      if (inputs["mermaid"]) {
        return setIfNew("```mermaid\n" + inputs["mermaid"] + "\n```");
      }
      if (inputs["mermaid-base64"]) {
        try {
          const diagram = decodeMarkdown(inputs["mermaid-base64"]);
          return setIfNew("```mermaid\n" + diagram + "\n```");
        } catch (err) {
          return setIfNew(
            `# Error decoding base64 metaframe input\n\n - key: "mermaid-base64"\n - value: ${
              inputs["mermaid-base64"]
            }\n - err: ${err}`,
          );
        }
      }
    });
  }, [metaframe, setIfNew]);

  // `url` hash param: fetch and render a remote document. This is what powers
  // every frame's Help tab.
  useEffect(() => {
    if (!url) return;
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(url, { mode: "cors", redirect: "follow" });
        if (!res.ok) {
          if (!cancelled) {
            doc.replace(
              `# Error getting URL: ${url}\n\n - status: ${res.status}\n - statusText: ${res.statusText}`,
            );
          }
          return;
        }
        const payload = absolutizeImages(await res.text(), url);
        if (cancelled) return;
        fromUrlRef.current = payload;
        doc.replace(payload);
      } catch (err) {
        if (!cancelled) doc.replace(`# Error getting URL: ${url}\n\n${err}`);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [url]);

  // Legacy `base64` key, from before the param was renamed to `md`. Only used
  // when `md` itself is empty, and content starting with `%` is from a still
  // older encoding — a content shim, not hash parsing.
  useEffect(() => {
    if (doc.value || !fromHashLegacy) return;
    const md = fromHashLegacy.startsWith("%")
      ? decodeURIComponent(fromHashLegacy)
      : fromHashLegacy;
    doc.replace(md);
  }, [fromHashLegacy, doc.value, doc.replace]);

  return [markdown, setMarkdownAndPersist];
}
