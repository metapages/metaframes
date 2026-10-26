// Host <-> path resolution.
//
// Every frame is reachable two ways:
//
//   https://markdown.mtfm.io/#?md=...     legacy; what published metapages embed
//   https://mtfm.io/markdown/#?md=...     one origin; what dev uses
//
// The subdomain form is rewritten to the path form inside main.ts's
// App.handler() override, which runs before Fresh's router and before every
// middleware — so dev and production share this one implementation.
//
// This module is deliberately pure: the label -> frame lookup is passed in
// rather than imported from lib/registry.ts, which is built by an
// import.meta.glob that only exists under Vite. That keeps the routing rules
// unit-testable with plain `deno test` (see host_test.ts).

/** Subdomain label (including legacy aliases) -> frame name. */
export type FrameByHostLabel = Record<string, string>;

/**
 * Hosts that serve the landing page at `/` and frames at `/<name>`. A frame
 * subdomain is a single label in front of one of these.
 *
 * An explicit list, not a "3+ labels means subdomain" heuristic: that
 * heuristic gets *.workers.dev wrong, and workers.dev is the hostname
 * Cloudflare hands out by default.
 */
const APEX_HOSTS = [
  "mtfm.io",
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
];

/** Every host under these is an apex: no subdomain frame routing. */
const APEX_SUFFIXES = [
  "workers.dev",
  "pages.dev",
];

/**
 * Paths that must never be prefixed with a frame name. In production
 * Cloudflare's assets layer answers most of these before the Worker runs, and
 * in dev Vite's middlewares answer them before Fresh — but `deno serve` on the
 * production build goes through Fresh for everything.
 */
const NEVER_REWRITE = [
  "/assets/", // built client bundles, referenced absolutely from the HTML
  "/@", // vite dev endpoints: /@vite/client, /@id/..., /@fs/...
  "/_fresh/",
  "/node_modules/",
  "/.vite/",
  "/.well-known/",
];

function hostname(host: string | null | undefined): string | null {
  if (!host) return null;
  let h = host.trim().toLowerCase();
  if (!h) return null;
  // IPv6 literal: "[::1]:5173" -> "::1"
  if (h.startsWith("[")) {
    const end = h.indexOf("]");
    return end === -1 ? null : h.slice(1, end);
  }
  const colon = h.indexOf(":");
  if (colon !== -1) h = h.slice(0, colon);
  return h || null;
}

/**
 * The frame subdomain label of a host, or null when the host is an apex.
 *
 *   markdown.localhost:5173 -> "markdown"
 *   markdownv2.mtfm.io      -> "markdownv2"
 *   mtfm.io, localhost      -> null
 *   metaframes.x.workers.dev -> null
 */
export function hostLabel(host: string | null | undefined): string | null {
  const h = hostname(host);
  if (!h) return null;
  if (APEX_HOSTS.includes(h)) return null;
  if (APEX_SUFFIXES.some((s) => h === s || h.endsWith(`.${s}`))) return null;

  for (const apex of APEX_HOSTS) {
    if (h.endsWith(`.${apex}`)) {
      const label = h.slice(0, -(apex.length + 1));
      // Only a single label in front of the apex is a frame subdomain.
      return label.includes(".") ? null : label;
    }
  }
  return null;
}

/** The frame a host serves, or null for the landing page. */
export function frameForHost(
  host: string | null | undefined,
  byLabel: FrameByHostLabel,
): string | null {
  const label = hostLabel(host);
  if (!label) return null;
  return byLabel[label] ?? null;
}

/**
 * The path a request should actually be served from, or null to leave it alone.
 *
 * Does two things: prefixes the frame name for subdomain requests, and strips a
 * trailing slash. The latter matters because Fresh registers `frames/x/index.tsx`
 * at the exact path `/x`, so `/markdown/` would otherwise 404 — and trailing
 * slashes are exactly what the old GitHub Pages URLs used.
 */
export function rewritePathname(
  pathname: string,
  host: string | null | undefined,
  byLabel: FrameByHostLabel,
): string | null {
  if (NEVER_REWRITE.some((p) => pathname.startsWith(p))) return null;

  let next = pathname;

  // "/markdown/" -> "/markdown"; "/" is left alone.
  if (next.length > 1 && next.endsWith("/")) next = next.slice(0, -1);

  const frame = frameForHost(host, byLabel);
  if (frame) {
    // Idempotent, and segment-aware so a frame named "md" does not swallow
    // "/md-something".
    const prefixed = next === `/${frame}` || next.startsWith(`/${frame}/`);
    if (!prefixed) next = next === "/" ? `/${frame}` : `/${frame}${next}`;
  }

  return next === pathname ? null : next;
}

/** Rewrite a subdomain / trailing-slash request into its canonical path form. */
export function rewriteRequestForHost(
  request: Request,
  byLabel: FrameByHostLabel,
): Request {
  const url = new URL(request.url);
  // The Host header is authoritative; request.url can carry the deployment's
  // own hostname depending on how the request arrived.
  const host = request.headers.get("host") ?? url.host;
  const pathname = rewritePathname(url.pathname, host, byLabel);
  if (pathname === null) return request;
  url.pathname = pathname;
  return new Request(url, request);
}

/**
 * The base URL of a frame in this same deployment, in whichever URL form the
 * current request is using. Works on the server (pass the request's protocol
 * and host) and in the browser (see frameBaseUrl).
 *
 *   on https://echo.mtfm.io           -> "https://markdown.mtfm.io"
 *   on http://localhost:5173/echo     -> "http://localhost:5173/markdown"
 *
 * `protocol` includes the trailing colon, matching `location.protocol`.
 * `host` includes the port, matching `location.host`.
 */
export function frameBaseUrlFrom(
  frameName: string,
  canonicalHostLabel: string,
  protocol: string,
  host: string,
): string {
  if (hostLabel(host)) {
    // Served on a frame subdomain: swap the left-most label, keeping the port.
    const [hostOnly, port] = host.startsWith("[") ? [host, ""] : [
      host.split(":")[0],
      host.includes(":") ? host.slice(host.indexOf(":")) : "",
    ];
    const apex = hostOnly.split(".").slice(1).join(".");
    return `${protocol}//${canonicalHostLabel}.${apex}${port}`;
  }
  return `${protocol}//${host}/${frameName}`;
}

/** Browser-side convenience wrapper around frameBaseUrlFrom. */
export function frameBaseUrl(
  frameName: string,
  canonicalHostLabel: string,
  loc?: Location,
): string {
  const l = loc ?? globalThis.location;
  if (!l) return `/${frameName}`;
  return frameBaseUrlFrom(frameName, canonicalHostLabel, l.protocol, l.host);
}
