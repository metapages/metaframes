// Preact hooks over the URL's search query (`?key=value`).
//
// Distinct from lib/hash/useHashParam.ts on purpose. The hash is a metaframe's
// *state*: it is what gets shared and embedded, and @metapages/metapage watches
// it and reports changes up to the parent metapage. The search query is not —
// nothing downstream reacts to it.
//
// So this is where local, per-viewer UI belongs: whether the menu happens to be
// open in this tab is nobody else's business, and writing it into the hash made
// every menu toggle look like the frame's state had changed.
//
// URLSearchParams is the right tool here. The rule against hand-rolling applies
// to the hash, whose wire format @metapages/hash-query owns; the query string
// is a standard the platform already parses.

import { useCallback, useEffect, useState } from "preact/hooks";

const IS_BROWSER = typeof document !== "undefined";

/**
 * `replaceState` fires no event, so writers announce themselves. Only this
 * module writes the search query, so a module-level set is enough; `popstate`
 * covers the back button.
 */
const listeners = new Set<() => void>();

function announce() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  globalThis.addEventListener("popstate", listener);
  return () => {
    listeners.delete(listener);
    globalThis.removeEventListener("popstate", listener);
  };
}

/** The raw value of a search param, or undefined when absent. */
export function getSearchParam(key: string): string | undefined {
  if (!IS_BROWSER) return undefined;
  return new URL(globalThis.location.href).searchParams.get(key) ?? undefined;
}

/**
 * Write a search param, or remove it when the value is undefined. Leaves the
 * hash untouched — that is the frame's state and must survive this.
 */
export function setSearchParam(key: string, value: string | undefined): void {
  if (!IS_BROWSER) return;
  const url = new URL(globalThis.location.href);
  if (value === undefined) {
    if (!url.searchParams.has(key)) return;
    url.searchParams.delete(key);
  } else {
    if (url.searchParams.get(key) === value) return;
    url.searchParams.set(key, value);
  }
  globalThis.history.replaceState(
    null,
    typeof document !== "undefined" ? document.title : "",
    `${url.pathname}${url.search}${url.hash}`,
  );
  announce();
}

/** Remove a search param from a URL without touching the page. */
export function deleteSearchParamFromUrl(url: URL, key: string): URL {
  const next = new URL(url.href);
  next.searchParams.delete(key);
  return next;
}

/**
 * A boolean search param, e.g. `?edit=true`.
 *
 * Reads `true` and `1` as true, since both appear in URLs people have written
 * by hand; writes `true`. Absent means false, and setting false removes it
 * rather than writing `?edit=false`.
 */
export function useSearchParamBoolean(
  key: string,
  defaultValue = false,
): [boolean, (value: boolean | undefined) => void] {
  const read = () => {
    const raw = getSearchParam(key);
    if (raw === undefined) return defaultValue;
    return raw === "true" || raw === "1";
  };

  const [value, setValue] = useState<boolean>(() =>
    IS_BROWSER ? read() : defaultValue
  );

  useEffect(() => {
    if (!IS_BROWSER) return;
    const update = () => setValue(read());
    update(); // the query was not known during SSR
    return subscribe(update);
  }, [key]);

  const set = useCallback((next: boolean | undefined) => {
    setSearchParam(key, next ? "true" : undefined);
  }, [key]);

  return [value, set];
}
