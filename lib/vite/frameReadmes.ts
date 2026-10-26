import type { Plugin } from "vite";

const VIRTUAL = "virtual:frame-readmes";
const RESOLVED = `\0${VIRTUAL}`;

/**
 * Exposes every frame's README.md as `virtual:frame-readmes`, a
 * `Record<frameName, markdown>`.
 *
 * A plain `import readme from "./README.md?raw"` cannot be used: Fresh's Deno
 * resolver drops the `?raw` query during the SSR production build, and rollup
 * then tries to parse the markdown as JavaScript. Reading the files here keeps
 * help text co-located with its frame (frames/<name>/README.md) while still
 * being bundled, which matters because the Worker has no filesystem.
 */
export function frameReadmes(framesDir = "frames"): Plugin {
  const read = (): Record<string, string> => {
    const out: Record<string, string> = {};
    for (const entry of Deno.readDirSync(framesDir)) {
      if (!entry.isDirectory) continue;
      try {
        out[entry.name] = Deno.readTextFileSync(
          `${framesDir}/${entry.name}/README.md`,
        );
      } catch {
        // A frame without a README simply has no help text.
      }
    }
    return out;
  };

  return {
    name: "metaframes:frame-readmes",
    resolveId(id) {
      return id === VIRTUAL ? RESOLVED : undefined;
    },
    load(id) {
      return id === RESOLVED
        ? `export default ${JSON.stringify(read())};`
        : undefined;
    },
    configureServer(server) {
      // Editing a README should hot-reload like any other source file.
      const invalidate = (path: string) => {
        if (!path.endsWith("README.md")) return;
        const mod = server.moduleGraph.getModuleById(RESOLVED);
        if (mod) server.moduleGraph.invalidateModule(mod);
        server.ws.send({ type: "full-reload" });
      };
      server.watcher.on("add", invalidate);
      server.watcher.on("change", invalidate);
      server.watcher.on("unlink", invalidate);
    },
  };
}
