// Reading the URL's search query (`?key=value`).
//
// Distinct from lib/hash/useHashParam.ts on purpose. The hash is a metaframe's
// *state*: it is what gets shared and embedded, and @metapages/metapage watches
// it and reports changes up to the parent metapage.
//
// The query is not state. Nothing here writes it — the shell's open/closed
// state is held in memory — so these are reads of configuration an author put
// in the URL deliberately, like `?edit=true` to open a frame with its menu
// already showing.
//
// URLSearchParams is the right tool here. The rule against hand-rolling applies
// to the hash, whose wire format @metapages/hash-query owns; the query string
// is a standard the platform already parses.

const IS_BROWSER = typeof document !== "undefined";

/** The raw value of a search param, or undefined when absent. */
export function getSearchParam(key: string): string | undefined {
  if (!IS_BROWSER) return undefined;
  return new URL(globalThis.location.href).searchParams.get(key) ?? undefined;
}

/**
 * A boolean search param. Accepts `true`, `1` and a bare `?edit` — all three
 * appear in URLs people write by hand. Absent means false.
 */
export function getSearchParamBoolean(key: string): boolean {
  const raw = getSearchParam(key);
  if (raw === undefined) return false;
  return raw === "" || raw === "true" || raw === "1";
}

/** Remove a search param from a URL without touching the page. */
export function deleteSearchParamFromUrl(url: URL, key: string): URL {
  const next = new URL(url.href);
  next.searchParams.delete(key);
  return next;
}
