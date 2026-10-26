import { assertEquals } from "jsr:@std/assert@^1";
import {
  frameBaseUrl,
  type FrameByHostLabel,
  frameForHost,
  hostLabel,
  rewritePathname,
} from "./host.ts";

// markdownv2 is a legacy alias: published metapages still embed it.
const BY_LABEL: FrameByHostLabel = {
  echo: "echo",
  markdown: "markdown",
  markdownv2: "markdown",
};

Deno.test("hostLabel", () => {
  const cases: [string | null | undefined, string | null][] = [
    ["markdown.mtfm.io", "markdown"],
    ["markdownv2.mtfm.io", "markdownv2"],
    ["markdown.localhost:5173", "markdown"],
    ["MARKDOWN.MTFM.IO", "markdown"],
    // apexes
    ["mtfm.io", null],
    ["localhost", null],
    ["localhost:5173", null],
    ["127.0.0.1:5173", null],
    ["[::1]:5173", null],
    // Cloudflare's default hostnames must not be read as frame subdomains
    ["metaframes.someacct.workers.dev", null],
    ["metaframes.pages.dev", null],
    // more than one label in front of the apex is not a frame
    ["a.b.mtfm.io", null],
    // unknown domains
    ["example.com", null],
    [null, null],
    [undefined, null],
    ["", null],
  ];
  for (const [host, expected] of cases) {
    assertEquals(hostLabel(host), expected, `hostLabel(${host})`);
  }
});

Deno.test("frameForHost resolves aliases", () => {
  assertEquals(frameForHost("markdownv2.mtfm.io", BY_LABEL), "markdown");
  assertEquals(frameForHost("markdown.localhost:5173", BY_LABEL), "markdown");
  assertEquals(frameForHost("mtfm.io", BY_LABEL), null);
  // a subdomain that is not a frame
  assertEquals(frameForHost("www.mtfm.io", BY_LABEL), null);
});

Deno.test("rewritePathname: subdomain form gets the frame prefix", () => {
  const h = "markdown.mtfm.io";
  assertEquals(rewritePathname("/", h, BY_LABEL), "/markdown");
  assertEquals(
    rewritePathname("/README.md", h, BY_LABEL),
    "/markdown/README.md",
  );
  assertEquals(
    rewritePathname("/readme-images/a.png", h, BY_LABEL),
    "/markdown/readme-images/a.png",
  );
  // alias resolves to the canonical frame name
  assertEquals(
    rewritePathname("/", "markdownv2.mtfm.io", BY_LABEL),
    "/markdown",
  );
});

Deno.test("rewritePathname: idempotent and segment-aware", () => {
  const h = "markdown.mtfm.io";
  // already prefixed -> no change
  assertEquals(rewritePathname("/markdown", h, BY_LABEL), null);
  assertEquals(rewritePathname("/markdown/README.md", h, BY_LABEL), null);
  // a path that merely starts with the frame name is still prefixed
  assertEquals(
    rewritePathname("/markdown-extra", h, BY_LABEL),
    "/markdown/markdown-extra",
  );
});

Deno.test("rewritePathname: trailing slashes are stripped", () => {
  // Fresh registers frames/<name>/index.tsx at the exact path /<name>, so
  // /markdown/ would 404 — and trailing slashes are what the old GitHub Pages
  // URLs used.
  assertEquals(rewritePathname("/markdown/", "mtfm.io", BY_LABEL), "/markdown");
  assertEquals(rewritePathname("/echo/", "localhost:5173", BY_LABEL), "/echo");
  assertEquals(rewritePathname("/", "mtfm.io", BY_LABEL), null);
  // subdomain + trailing slash
  assertEquals(
    rewritePathname("/README.md/", "markdown.mtfm.io", BY_LABEL),
    "/markdown/README.md",
  );
});

Deno.test("rewritePathname: apex path form is left alone", () => {
  assertEquals(rewritePathname("/markdown", "mtfm.io", BY_LABEL), null);
  assertEquals(rewritePathname("/", "localhost:5173", BY_LABEL), null);
});

Deno.test("rewritePathname: reserved paths are never prefixed", () => {
  const h = "markdown.mtfm.io";
  for (
    const p of [
      "/assets/client-entry-abc123.js",
      "/@vite/client",
      "/@id/fresh-island::Echo",
      "/_fresh/client/x.js",
      "/node_modules/.vite/deps/preact.js",
      "/.vite/manifest.json",
      "/.well-known/acme-challenge/x",
    ]
  ) {
    assertEquals(rewritePathname(p, h, BY_LABEL), null, p);
  }
});

Deno.test("frameBaseUrl mirrors the current URL form", () => {
  // subdomain form -> swap the label
  assertEquals(
    frameBaseUrl("markdown", "markdown", {
      protocol: "https:",
      host: "echo.mtfm.io",
      hostname: "echo.mtfm.io",
      port: "",
      origin: "https://echo.mtfm.io",
    } as Location),
    "https://markdown.mtfm.io",
  );
  // dev subdomain form keeps the port
  assertEquals(
    frameBaseUrl("markdown", "markdown", {
      protocol: "http:",
      host: "echo.localhost:5173",
      hostname: "echo.localhost",
      port: "5173",
      origin: "http://echo.localhost:5173",
    } as Location),
    "http://markdown.localhost:5173",
  );
  // path form -> append the frame name
  assertEquals(
    frameBaseUrl("markdown", "markdown", {
      protocol: "http:",
      host: "localhost:5173",
      hostname: "localhost",
      port: "5173",
      origin: "http://localhost:5173",
    } as Location),
    "http://localhost:5173/markdown",
  );
});
