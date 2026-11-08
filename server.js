// The Cloudflare Worker entry.
//
// Fresh's build emits `_fresh/server.js` already shaped as `{ fetch }`, and
// nearly everything this app needs is inside it: the subdomain -> path rewrite
// is an `App.handler()` override in main.ts, so dev and production share one
// implementation.
//
// The one thing that generated entry drops is `env`, and with it the assets
// binding — which the Worker does need. Cloudflare's assets layer answers
// static files before the Worker runs, but only for the URL as it *arrived*. A
// subdomain request (markdown.mtfm.io/readme-images/x.png) is rewritten to the
// path form inside the Worker, which the assets layer never saw, and Fresh's
// own staticFiles() cannot serve it there: its production cache opens files
// with Deno.open, which workerd does not have. Without this the rewritten
// request is a 500.
//
// A global, because the app was already bundled by Vite — this module and the
// one Vite bundled are two different instances, so a setter would not reach it.
import server from "./_fresh/server.js";

export default {
  fetch(request, env, ctx) {
    globalThis.__CF_ASSETS ??= env.ASSETS;
    return server.fetch(request, env, ctx);
  },
};
