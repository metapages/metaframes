import { FRAMES } from "./registry.ts";
import { frameBaseUrlFrom } from "./host.ts";

/**
 * Where published metaframes render their help from. Used only as a fallback:
 * normally the markdown frame in this same deployment renders it, so help works
 * offline, in dev, and on a preview deployment.
 */
const FALLBACK_MARKDOWN_ORIGIN = "https://markdown.mtfm.io";

/**
 * The URL of a frame's help document, rendered by this deployment's markdown
 * frame.
 *
 * Reproduces the convention every existing metaframe uses:
 * `<markdown-origin>/#?hm=disabled&url=<frame-origin>/README.md`. The `url`
 * value is intentionally NOT percent-encoded — the hash parser splits on `&`
 * and the first `=` only, and the markdown frame reads the raw stored value.
 */
export function helpUrl(
  frameName: string,
  protocol: string,
  host: string,
): string {
  const self = frameBaseUrlFrom(
    frameName,
    FRAMES[frameName]?.hosts[0] ?? frameName,
    protocol,
    host,
  );
  const readme = `${self}/README.md`;

  const markdown = FRAMES["markdown"];
  const viewer = markdown
    ? frameBaseUrlFrom("markdown", markdown.hosts[0], protocol, host)
    : FALLBACK_MARKDOWN_ORIGIN;

  return `${viewer}/#?hm=disabled&url=${readme}`;
}
