// Prints every dev hostname a frame answers on, space separated:
//
//   markdown.localhost markdownv2.localhost echo.localhost py.localhost ...
//
// Used by `just _mkcert` to name each subdomain explicitly in the dev
// certificate. A wildcard will not do: Chrome rejects `*.localhost` with
// ERR_CERT_COMMON_NAME_INVALID, because a wildcard is not valid directly
// under a single-label top-level domain.
//
// This reads the frame.ts modules directly rather than lib/registry.ts, which
// pulls in a Vite virtual module and so cannot be imported outside the build.

const FRAMES_DIR = new URL("../frames/", import.meta.url);

const labels: string[] = [];

for await (const entry of Deno.readDir(FRAMES_DIR)) {
  if (!entry.isDirectory) continue;
  const module = new URL(`${entry.name}/frame.ts`, FRAMES_DIR);
  try {
    const { frame } = await import(module.href) as {
      frame?: { hosts?: string[] };
    };
    for (const host of frame?.hosts ?? []) labels.push(host);
  } catch {
    // A directory without a usable frame.ts simply has no hostnames.
  }
}

if (labels.length === 0) Deno.exit(0);
console.log([...new Set(labels)].sort().map((l) => `${l}.localhost`).join(" "));
