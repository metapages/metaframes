import { defineConfig } from "vite";
import { fresh } from "@fresh/plugin-vite";
import tailwindcss from "@tailwindcss/vite";
import { frameReadmes } from "./lib/vite/frameReadmes.ts";

/**
 * HTTPS in dev when `just _mkcert` has run. It is not a nicety: an https parent
 * page (app.metapage.io) cannot embed an http iframe, so testing a frame the
 * way it is actually used requires TLS locally.
 */
function devCerts() {
  try {
    return {
      key: Deno.readTextFileSync(".certs/localhost-key.pem"),
      cert: Deno.readTextFileSync(".certs/localhost.pem"),
    };
  } catch {
    return undefined;
  }
}

// `ignore` REPLACES the plugin's default, so the test-file pattern has to be
// restated.
//
// Fresh crawls every .ts/.tsx under routeDir and registers it as a route. A
// frame directory also holds co-located modules that are not routes (frame.ts,
// options.ts, ...); without this they would register as broken routes with no
// default export — silently, because Fresh suppresses missing-export warnings
// for route modules.
//
// The convention: inside frames/<name>/, only index.* is a route. Islands live
// in (_islands)/ and are matched by their parentheses, so they are untouched.
const IGNORE = [
  /[._]test\.(?:[tj]sx?|[mc][tj]s)$/,
  /[/\\]frames[/\\][^/\\]+[/\\](?!index\.)[^/\\]*\.(?:tsx?|jsx?)$/,
];

export default defineConfig({
  plugins: [
    // Each metaframe is a directory under ./frames/, so the frames directory
    // *is* the Fresh route directory.
    fresh({ routeDir: "./frames", ignore: IGNORE }),
    tailwindcss(),
    frameReadmes(),
  ],
  server: {
    // Frames are reachable per-subdomain in dev (markdown.localhost, ...), so
    // any Host header must be accepted. `host: true` also binds ::1, which is
    // what Chrome resolves *.localhost to — no IPv6 proxy needed.
    //
    // Do NOT set host: "::" — @fresh/plugin-vite's dev server interpolates this
    // value into a URL and `http://:::5173/` throws Invalid URL on every
    // request.
    host: true,
    allowedHosts: true,
    https: devCerts(),
  },
});
