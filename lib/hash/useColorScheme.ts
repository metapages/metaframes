import { useEffect, useState } from "preact/hooks";
import { useHashParamJson } from "./useHashParam.ts";

/**
 * The frame's colour scheme, from `options.theme`.
 *
 * Published vocabulary, unchanged: `light`, `vs-dark` (a Monaco theme id that
 * leaked into the URL format in metaframe-markdown-v2's editor and is now
 * what shared links contain) and `system`. `dark` is accepted as the obvious
 * spelling someone will reach for by hand.
 */
export type ColorScheme = "light" | "dark" | "vs-dark" | "system";

/**
 * Light, not the viewer's system setting.
 *
 * A frame has a transparent background so the metapage embedding it shows
 * through, which means the frame's text has to be readable against *that
 * page's* colours, not the viewer's device preference. app.metapage.io is
 * light-only, so a dark-mode viewer following their device would get pale text
 * on a white page. This is also what metaframe-markdown-v2 shipped
 * (`defaultOptions = { theme: "light" }`), so published URLs are unaffected.
 *
 * frames/_app.tsx writes the same value into the server-rendered HTML, so the
 * frame does not flash a dark theme before this hook runs.
 */
export const DEFAULT_COLOR_SCHEME: ColorScheme = "light";

/** What `data-theme` the scheme means, or null to follow the device. */
export function themeAttributeFor(
  scheme: ColorScheme | string | undefined,
): "light" | "dark" | null {
  if (!scheme || scheme === DEFAULT_COLOR_SCHEME) return "light";
  if (scheme === "system") return null;
  return scheme === "light" ? "light" : "dark";
}

/**
 * Apply the colour scheme to the document.
 *
 * `data-theme` is the switch assets/styles.css is built around: absent means
 * "follow prefers-color-scheme", and either explicit value pins the palette.
 *
 * `optionsKey` is the frame's settings param, because the scheme travels in
 * that blob rather than as its own param — that is where the published editor
 * put it, and a settings panel's worth of presentation should move as one
 * value.
 */
export function useHashParamColorScheme(optionsKey: string = "options"): void {
  const [options] = useHashParamJson<{ theme?: string }>(optionsKey, {});
  const theme = themeAttributeFor(options?.theme);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === null) root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", theme);
  }, [theme]);
}

/**
 * The scheme a frame is actually drawing in, with `system` resolved against
 * the device and kept in step if the device setting changes while open.
 *
 * `useHashParamColorScheme` can leave `system` to CSS, because
 * `prefers-color-scheme` is a media query. Anything drawn in JavaScript — a
 * canvas, a syntax-highlighting theme — has to be told, so it asks here.
 */
export function useResolvedColorScheme(
  optionsKey: string = "options",
): "light" | "dark" {
  const [options] = useHashParamJson<{ theme?: string }>(optionsKey, {});
  const pinned = themeAttributeFor(options?.theme);
  const [device, setDevice] = useState<"light" | "dark">("light");

  useEffect(() => {
    if (pinned !== null) return;
    const query = globalThis.matchMedia?.("(prefers-color-scheme: dark)");
    if (!query) return;
    const read = () => setDevice(query.matches ? "dark" : "light");
    read();
    query.addEventListener("change", read);
    return () => query.removeEventListener("change", read);
  }, [pinned]);

  return pinned ?? device;
}

/**
 * The Monaco theme id for a resolved scheme.
 *
 * Monaco registers `vs`, `vs-dark`, `hc-black` and `hc-light`; `light` is not
 * one of them. The published editor passes `options.theme` straight through,
 * so its `light` falls back to `vs` inside Monaco's theme service — the right
 * result by accident. This says it on purpose.
 */
export function monacoThemeFor(scheme: "light" | "dark"): string {
  return scheme === "dark" ? "vs-dark" : "vs";
}
