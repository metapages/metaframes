import { useCallback, useEffect, useRef, useState } from "preact/hooks";
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
 * Three sources, in strict order of authority:
 *
 * 1. **metaframe inputs** (`markdown` / `md` / `markdown-base64` /
 *    `md-base64` / `mermaid` / `mermaid-base64`) — live data, always wins.
 * 2. **the `url` hash param** — fetched over CORS. It *overrides* `md`: while
 *    the fetch is in flight nothing is shown, so a URL-backed document never
 *    flashes the stale `md` it is about to replace.
 * 3. **the `md` hash param** (or legacy `base64`).
 *
 * Editing a URL-backed document detaches it: the text becomes this frame's
 * own, it is written to `md`, and `url` is dropped — otherwise the next load
 * would refetch and discard the edit. So `url` is the document's *origin*,
 * not a live binding, and the first keystroke is what severs it.
 */
export function useMarkdown(): [string, (markdown: string) => void] {
  const metaframe = useMetaframe();
  const [url] = useHashParam(HashKeyUrl);
  // The frame's *own* document: renders immediately, reaches the hash once
  // typing pauses, and ignores its own write coming back. Shared with every
  // other frame that has an editor.
  const doc = useHashParamDocument(HashKeyMarkdown);
  const [fromHashLegacy] = useHashParamBase64(HashKeyMarkdownLegacy);

  /**
   * Text from a metaframe input, and text fetched from `url`.
   *
   * These are held apart from `doc` rather than pushed into it, which is the
   * whole point: `doc` mirrors the `md` hash param, so anything written there
   * is at the mercy of the next `md` notification. hash-query dispatches a
   * synthetic hashchange after it rewrites the hash, so that notification can
   * land *after* a fetch resolves — and a URL-backed document would silently
   * blank itself the moment any hash param changed. Precedence belongs in one
   * expression, not in a race between effects.
   *
   * `undefined` means "this tier has nothing to say"; `""` is a real value, so
   * a `url` that has not resolved yet shows empty rather than falling through
   * to `md`.
   */
  const [fromInput, setFromInput] = useState<string | undefined>(undefined);
  const [fromUrl, setFromUrl] = useState<string | undefined>(
    () => (url ? "" : undefined),
  );

  const markdown = fromInput ?? (fromUrl !== undefined ? fromUrl : doc.value);

  /**
   * The text last fetched from `url`. An editor mounting on it echoes it
   * straight back through onChange, and that echo must not be mistaken for an
   * edit — it would detach a document nobody touched.
   */
  const fromUrlRef = useRef<string | undefined>(undefined);
  const previousInputRef = useRef<string | undefined>(undefined);

  /** A metaframe input arrived: show it, but do not write it to the hash. */
  const setIfNew = useCallback((next: string) => {
    if (previousInputRef.current === next) return;
    previousInputRef.current = next;
    setFromInput(next);
  }, []);

  /** Edited here. The document becomes this frame's own. */
  const setMarkdownAndPersist = useCallback((next: string) => {
    if (fromUrlRef.current === next) return;
    fromUrlRef.current = undefined;
    // Drop the higher tiers in the same tick, so the edit is visible at once
    // rather than after `url` has finished leaving the hash.
    setFromInput(undefined);
    setFromUrl(undefined);
    doc.edit(next);
    // `url` described a document that no longer exists; leaving it would
    // refetch over the edit on the next load.
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
    if (!url) {
      // No url (or an edit just removed it): `md` is the document again.
      setFromUrl(undefined);
      return;
    }

    let cancelled = false;
    // Withhold `md` from the moment a url appears, so a URL-backed document
    // never flashes the content it is about to replace.
    setFromUrl("");

    const settle = (payload: string) => {
      if (!cancelled) setFromUrl(payload);
    };

    (async () => {
      try {
        const res = await fetch(url, { mode: "cors", redirect: "follow" });
        if (!res.ok) {
          settle(
            `# Error getting URL: ${url}\n\n - status: ${res.status}\n - statusText: ${res.statusText}`,
          );
          return;
        }
        const payload = absolutizeImages(await res.text(), url);
        if (cancelled) return;
        fromUrlRef.current = payload;
        settle(payload);
      } catch (err) {
        settle(`# Error getting URL: ${url}\n\n${err}`);
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
