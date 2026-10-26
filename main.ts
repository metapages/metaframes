import { App, cors, staticFiles } from "fresh";
import { define, type State } from "./utils.ts";
import { FRAME_BY_HOST_LABEL, FRAMES } from "./lib/registry.ts";
import { rewriteRequestForHost } from "./lib/host.ts";
import { prefixRelativeAssets } from "./lib/markdown/links.ts";

/**
 * Fresh's App, with the subdomain -> path rewrite applied in front of the
 * router.
 *
 * It has to happen here rather than in a middleware: by the time middlewares
 * run, `router.match()` has already chosen a handler, so mutating
 * `ctx.url.pathname` cannot re-route. Overriding `handler()` works in both dev
 * and production because the generated `_fresh/server.js` is literally
 * `{ fetch: app.handler() }`, and the dev server loads the same entry.
 */
class FrameApp<S> extends App<S> {
  override handler(): (
    request: Request,
    info?: Deno.ServeHandlerInfo,
  ) => Promise<Response> {
    const inner = super.handler();
    return (request, info) =>
      inner(rewriteRequestForHost(request, FRAME_BY_HOST_LABEL), info);
  }
}

export const app = new FrameApp<State>();

// Metaframes are always embedded cross-origin in a metapage iframe, and their
// definition, help text and assets are fetched cross-origin too. Everything
// this app serves is public.
app.use(cors({ origin: "*" }));

/**
 * Resolve the frame from the first path segment onto ctx.state. Subdomain
 * requests were already rewritten to the path form above, so the path is the
 * single source of truth from here on.
 */
app.use(define.middleware(async (ctx) => {
  const name = ctx.url.pathname.split("/")[1];
  const frame = (name && FRAMES[name]) || null;
  ctx.state.frame = frame;

  const res = await ctx.next();

  // Per-frame response headers. These are per-frame rather than app-wide
  // because the ones frames need would break the other frames: ffmpeg's
  // Cross-Origin-Embedder-Policy blocks cross-origin embedding, and
  // Permissions-Policy is frame-specific.
  //
  // Note this only reaches document/API responses. On Cloudflare, static
  // assets are answered by the assets layer before the Worker runs; those need
  // static/_headers instead.
  if (frame?.headers) {
    for (const [key, value] of Object.entries(frame.headers)) {
      res.headers.set(key, value);
    }
  }
  return res;
}));

app.use(staticFiles());

/** The frame's public definition, read by the embedding metapage. */
app.get("/:frame/metaframe.json", (ctx) => {
  const frame = FRAMES[ctx.params.frame];
  if (!frame) return ctx.next();
  return Response.json(frame.definition);
});

/** The frame's help document, rendered in-app by the markdown frame. */
app.get("/:frame/README.md", (ctx) => {
  const frame = FRAMES[ctx.params.frame];
  if (!frame?.readme) return ctx.next();
  // Relative image paths are rewritten to /<frame>/... so they resolve in both
  // the path and the subdomain URL form.
  return new Response(prefixRelativeAssets(frame.readme, frame.name), {
    headers: { "content-type": "text/markdown; charset=utf-8" },
  });
});

app.fsRoutes();
