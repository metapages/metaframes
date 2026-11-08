import { useEffect } from "preact/hooks";
import { useHashParamBase64, useHashParamJson } from "./useHashParam.ts";

/**
 * Restyle a frame from the `css` hash param.
 *
 * The value is base64-encoded and is either a stylesheet URL or raw CSS text.
 * It replaces what `dm=slide` used to do: rather than the renderer shipping one
 * hard-coded alternative layout, the URL carries whatever styling it wants and
 * the renderer stays ignorant of it.
 *
 *     #?md=...&css=<base64 of "https://example.com/slides.css">
 *     #?md=...&css=<base64 of ".markdown-body h1 { text-align: center }">
 *
 * Ported from metaframe-markdown-v2 (worker/index.html), wire format unchanged.
 */

/** The hash param this reads. */
export const HASH_KEY_CSS = "css";

/** Tags the injected element so a change replaces it rather than stacking. */
const ELEMENT_ID = "mtfm-css-hash-param";

/**
 * A single-line http(s) URL is a stylesheet to link; anything else is CSS text.
 * Deliberately strict — a value with any whitespace is a stylesheet body.
 */
function isStylesheetUrl(value: string): boolean {
  const trimmed = value.trim();
  return /^https?:\/\/\S+$/.test(trimmed) && !/\s/.test(trimmed);
}

export function useHashParamCss(key: string = HASH_KEY_CSS): void {
  const [css] = useHashParamBase64(key);

  useEffect(() => {
    // Clear first, so emptying the param removes the styling, and so a stale
    // element from a previous mount never survives alongside the new one.
    document.getElementById(ELEMENT_ID)?.remove();
    if (!css) return;

    let element: HTMLLinkElement | HTMLStyleElement;
    if (isStylesheetUrl(css)) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = css.trim();
      element = link;
    } else {
      const style = document.createElement("style");
      style.textContent = css;
      element = style;
    }
    element.id = ELEMENT_ID;
    document.head.appendChild(element);

    return () => element.remove();
  }, [css]);
}

/** The hash param holding the CSS URL list. */
export const HASH_KEY_CSS_URLS = "modules";

/** Marks the links this hook owns, so a change replaces exactly those. */
const URL_ELEMENT_CLASS = "mtfm-css-url";

/** Module-level, so an absent param hands back the same array every render. */
const NO_URLS: string[] = [];

/**
 * One list entry -> the stylesheet URL to load, or undefined to skip it.
 *
 * Two published forms, both produced by the same editor field: a bare URL,
 * and a whole `<link rel="stylesheet" href="...">` tag. A `{`-prefixed entry
 * is an import map from this list's days as metaframe-js's module list, and
 * the published renderer skipped those too.
 */
function hrefOf(entry: string): string | undefined {
  const trimmed = entry.trim();
  if (!trimmed || trimmed.startsWith("{")) return undefined;
  if (trimmed.startsWith("<")) {
    return /href="([^"]*)"/.exec(trimmed)?.[1];
  }
  return trimmed;
}

/**
 * Load the stylesheets listed in the `modules` hash param.
 *
 * The plural counterpart to useHashParamCss: `css` carries one stylesheet or
 * a block of CSS text, this carries a list of URLs — the published editor's
 * "CSS URLs" setting, wire format unchanged (a JSON array of strings).
 *
 * Ported from metaframe-markdown-v2 (worker/index.html, `ensureModulesLoaded`),
 * minus its awaiting: the published renderer blocked the first markdown render
 * on every link's load event, which meant one unreachable stylesheet left the
 * frame permanently blank. Here the links are appended and the frame renders.
 */
export function useHashParamCssUrls(key: string = HASH_KEY_CSS_URLS): void {
  const [list] = useHashParamJson<string[]>(key, NO_URLS);
  // A string, so the effect compares by value: useHashParamJson parses the
  // param on every hash change and hands back a new array each time.
  const signature = (list ?? []).join("\n");

  useEffect(() => {
    const hrefs = signature.split("\n").map(hrefOf).filter((
      href,
    ): href is string => !!href);

    // Cleared first, so removing an entry removes its stylesheet.
    for (const stale of document.querySelectorAll(`.${URL_ELEMENT_CLASS}`)) {
      stale.remove();
    }
    const added = hrefs.map((href) => {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = href;
      link.className = URL_ELEMENT_CLASS;
      document.head.appendChild(link);
      return link;
    });

    return () => {
      for (const link of added) link.remove();
    };
  }, [signature]);
}
