import type { Plugin, ViteDevServer } from "vite";
import { rewritePathname } from "../host.ts";
import type { FrameByHostLabel } from "../host.ts";

/**
 * Makes subdomain routing work in the dev server.
 *
 * Production does this in main.ts, in an `App.handler()` override that sees
 * the real Request. The dev server cannot: `@fresh/plugin-vite`'s dev
 * middleware throws the authority away and rebuilds the URL from the Vite
 * config —
 *
 *   const host = serverCfg.host ? serverCfg.host : "localhost";
 *   const url = new URL(`${protocol}://${host}:${port}${nodeReq.url ?? "/"}`);
 *
 * — so by the time the app runs, `markdown.localhost` is gone and every
 * subdomain renders the apex gallery. (The same reconstruction is why a
 * frame's help URL is resolved in the browser rather than on the server; see
 * lib/help.ts.)
 *
 * Rewriting `req.url` here, ahead of Fresh, puts the frame in the path
 * instead — the other URL form the app already serves — so the one rule in
 * `rewritePathname` still decides everything.
 */
export function hostRewrite(): Plugin {
  // The registry cannot be imported at module scope: it reads the
  // `virtual:frame-readmes` module, which only exists inside the Vite build,
  // and vite.config.ts is loaded outside it. Pulling it through the dev
  // server's own module graph keeps one source of truth for the host labels,
  // aliases included.
  let labels: Promise<FrameByHostLabel> | undefined;

  const loadLabels = (server: ViteDevServer): Promise<FrameByHostLabel> => {
    if (!labels) {
      labels = server
        .ssrLoadModule("/lib/registry.ts")
        .then((mod) => mod.FRAME_BY_HOST_LABEL as FrameByHostLabel)
        .catch((err) => {
          server.config.logger.warn(
            `[metaframes] subdomain routing is off: ${err}`,
          );
          return {};
        });
    }
    return labels;
  };

  type Req = {
    url?: string;
    headers: Record<string, string | string[] | undefined>;
  };

  /**
   * Paths the app serves that look like files. Everything else with a dot in
   * it belongs to Vite in dev (`/client.ts`, `/components/FrameShell.tsx`, …).
   * Mirrors the routes registered in main.ts.
   */
  const APP_FILE_ROUTES = ["/metaframe.json", "/README.md"];

  /**
   * Whether this request is for the app rather than for Vite.
   *
   * In production the Worker only ever sees app routes, so the reserved-prefix
   * list in `rewritePathname` is enough. The dev server also serves every
   * source module at its real path, and those cannot be enumerated — rewriting
   * `/client.ts` to `/markdown/client.ts` 404s the whole page. A document
   * navigation is the one thing that is unambiguously the app's, plus the two
   * file-looking routes main.ts registers. A frame's static assets are already
   * requested with their frame prefix (see lib/markdown/links.ts), so they
   * pass through untouched.
   */
  const isAppRequest = (req: Req, path: string): boolean => {
    if (APP_FILE_ROUTES.includes(path)) return true;
    const accept = req.headers.accept;
    const value = Array.isArray(accept) ? accept[0] : accept;
    return !!value?.includes("text/html");
  };

  /**
   * The requested authority.
   *
   * Vite serves HTTPS over HTTP/2, which has no `host` header at all — the
   * name travels in the `:authority` pseudo-header. Reading `headers.host`
   * alone finds nothing over https, so every subdomain silently falls through
   * to the apex.
   */
  const authorityOf = (req: Req): string | undefined => {
    const raw = req.headers[":authority"] ?? req.headers.host;
    return Array.isArray(raw) ? raw[0] : raw;
  };

  return {
    name: "metaframes:host-rewrite",
    // Vite runs `pre` plugins ahead of normal ones. Without this Fresh's dev
    // middleware registers first and answers the request before this sees it.
    enforce: "pre",
    configureServer(server) {
      server.middlewares.use((rawReq, _res, next) => {
        const req = rawReq as unknown as Req;
        const url = req.url;
        const host = authorityOf(req);
        if (!url || !host) return next();

        // Cheap bail before the async hop, so a plain `localhost` request
        // never waits on the registry.
        const label = host.split(":")[0].split(".")[0];
        if (!label || label === "localhost") return next();

        loadLabels(server)
          .then((byLabel) => {
            // Vite's own endpoints come through here too; rewritePathname's
            // reserved-prefix list keeps /@vite/client and friends intact.
            const [path, query] = url.split("?");
            if (!isAppRequest(req, path)) return;
            const rewritten = rewritePathname(path, host, byLabel);
            if (rewritten !== null) {
              req.url = query === undefined
                ? rewritten
                : `${rewritten}?${query}`;
            }
          })
          .catch(() => {})
          .finally(next);
      });
    },
  };
}
