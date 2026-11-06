import { useEffect } from "preact/hooks";
import { useHashParamBase64 } from "./useHashParam.ts";

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
