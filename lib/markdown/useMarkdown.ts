import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import { setHashParamInWindow } from "@metapages/hash-query";
import { useHashParam, useHashParamBase64 } from "../hash/useHashParam.ts";
import { useMetaframe } from "../metaframe/useMetaframe.ts";

// Hash param keys, unchanged from the deployed markdown metaframe: `base64`
// was the original name for the content param and published URLs still use it.
export const HashKeyMarkdown = "md";
export const HashKeyMarkdownLegacy = "base64";
export const HashKeyUrl = "url";

/**
 * Base64 here is `btoa(encodeURIComponent(s))`, not bare `btoa`: bare btoa
 * throws on any non-Latin1 character and corrupts `%`.
 */
const decodeMarkdown = (b64: string): string =>
  decodeURIComponent(globalThis.atob(b64));

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
  const [fromHash, setFromHash] = useHashParamBase64(HashKeyMarkdown);
  const [fromHashLegacy] = useHashParamBase64(HashKeyMarkdownLegacy);

  const [markdown, setMarkdown] = useState("");
  const fromUrlRef = useRef<string | undefined>(undefined);
  const previousInputRef = useRef<string | undefined>(undefined);

  const setIfNew = useCallback((next: string) => {
    if (previousInputRef.current === next) return;
    previousInputRef.current = next;
    setMarkdown(next);
  }, []);

  /** Persist edited markdown; writing content invalidates any `url` param. */
  const setMarkdownAndPersist = useCallback((next: string) => {
    if (fromUrlRef.current === next) return;
    setFromHash(next === "" ? undefined : next);
    setHashParamInWindow(HashKeyUrl, undefined);
  }, [setFromHash]);

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
            setMarkdown(
              `# Error getting URL: ${url}\n\n - status: ${res.status}\n - statusText: ${res.statusText}`,
            );
          }
          return;
        }
        const payload = absolutizeImages(await res.text(), url);
        if (cancelled) return;
        fromUrlRef.current = payload;
        setMarkdown(payload);
      } catch (err) {
        if (!cancelled) setMarkdown(`# Error getting URL: ${url}\n\n${err}`);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [url]);

  // `md` / legacy `base64` hash param.
  useEffect(() => {
    if (!fromHash && !fromHashLegacy) return;
    let md = fromHash || fromHashLegacy || "";
    // Older versions URI-encoded the content inside the hash param; anything
    // starting with `%` is from that era.
    if (md.startsWith("%")) md = decodeURIComponent(md);
    setMarkdown(md);
  }, [fromHash, fromHashLegacy]);

  return [markdown, setMarkdownAndPersist];
}
