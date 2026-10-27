import { FRAMES } from "./registry.ts";
import { frameBaseUrl } from "./host.ts";

/**
 * Where published metaframes render their help from. Used only as a fallback:
 * normally the markdown frame in this same deployment renders it, so help works
 * offline, in dev, and on a preview deployment.
 */
const FALLBACK_MARKDOWN_ORIGIN = "https://markdown.mtfm.io";

/**
 * Everything needed to build a frame's help URL, resolved from the registry on
 * the server and handed to the island as plain strings.
 */
export interface HelpConfig {
  /** The frame whose README is shown. */
  frame: string;
  frameLabel: string;
  /** The frame that renders it — the markdown frame, when this deployment has one. */
  viewer: string | null;
  viewerLabel: string | null;
}

/** Server-side: resolve a frame's help configuration from the registry. */
export function helpConfig(frameName: string): HelpConfig {
  const markdown = FRAMES["markdown"];
  return {
    frame: frameName,
    frameLabel: FRAMES[frameName]?.hosts[0] ?? frameName,
    viewer: markdown ? markdown.name : null,
    viewerLabel: markdown ? markdown.hosts[0] : null,
  };
}

/**
 * Client-side: the URL of a frame's help document, rendered by this
 * deployment's markdown frame.
 *
 * Built from `location` rather than server-side from the request, because
 * neither source of truth on the server is reliable: `Host` is a forbidden
 * header name, so it is stripped when the Request is constructed, and Fresh's
 * dev server drops the port from `ctx.url` — which silently produced help
 * links to port 443.
 *
 * Reproduces the convention every existing metaframe uses:
 * `<markdown-origin>/#?hm=disabled&url=<frame-origin>/README.md`. The `url`
 * value is intentionally NOT percent-encoded — the hash parser splits on `&`
 * and the first `=` only, and the markdown frame reads the raw stored value.
 */
export function helpUrlFrom(config: HelpConfig, loc?: Location): string {
  const self = frameBaseUrl(config.frame, config.frameLabel, loc);
  const readme = `${self}/README.md`;

  const viewer = config.viewer && config.viewerLabel
    ? frameBaseUrl(config.viewer, config.viewerLabel, loc)
    : FALLBACK_MARKDOWN_ORIGIN;

  return `${viewer}/#?hm=disabled&url=${readme}`;
}
