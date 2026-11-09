import type * as MonacoApi from "monaco-editor";

/** The Monaco namespace, as the AMD bundle hands it over. */
export type Monaco = typeof MonacoApi;

/**
 * Monaco, loaded from this deployment rather than from a CDN.
 *
 * The published editor loads `monaco-editor@0.43.0` from cdn.jsdelivr.net at
 * runtime. That makes a critical frame depend on a third party being reachable:
 * one jsDelivr outage, one network that blocks public CDNs, and the editor
 * never appears — with nothing in our logs to say why. `just _monaco` copies
 * the same files into `static/editor/vs`, so they come from the same origin as
 * the frame, over the Cloudflare edge.
 *
 * It is still the AMD build, loaded through Monaco's own `loader.js`, rather
 * than the ESM build bundled by Vite. Monaco's ESM build wants a bundler
 * plugin and emits its five language workers as separate entry points; the AMD
 * build resolves all of that itself from one `vs` path, and is exactly what
 * production serves today. Nothing about Monaco enters any frame's bundle.
 */

/** Monaco's AMD loader, which `loader.js` installs as a global. */
interface AmdRequire {
  (modules: string[], onLoad: (loaded: unknown) => void): void;
  config: (options: { paths: Record<string, string> }) => void;
}

interface MonacoGlobals {
  require?: AmdRequire;
  monaco?: Monaco;
  MonacoEnvironment?: unknown;
}

/**
 * One load per page, shared by every caller.
 *
 * Loading twice would re-register all 90 languages against the same global
 * namespace, so this promise is the lock as well as the cache.
 */
let loading: Promise<Monaco> | undefined;

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () =>
      reject(new Error(`Could not load the editor from ${src}`));
    document.head.appendChild(script);
  });
}

/**
 * Load Monaco from `<base>/vs`, where `base` is this frame's own base URL —
 * `https://editor.mtfm.io` on a subdomain, `https://mtfm.io/editor` on a path.
 * Both resolve to the same `static/editor/vs/` files (the subdomain form is
 * rewritten to the path form inside the Worker).
 */
export function loadMonaco(base: string): Promise<Monaco> {
  if (loading) return loading;

  const vs = `${base.replace(/\/$/, "")}/vs`;
  const globals = globalThis as MonacoGlobals;

  loading = loadScript(`${vs}/loader.js`)
    .then(() =>
      new Promise<Monaco>((resolve, reject) => {
        const amdRequire = globals.require;
        if (!amdRequire) {
          reject(new Error("The editor loaded but installed no module loader"));
          return;
        }
        // Where the loader resolves `vs/...` module ids. The language workers
        // are fetched from here too, and because they are same-origin there is
        // no need for the cross-origin worker-proxy shim a CDN load requires.
        amdRequire.config({ paths: { vs } });
        amdRequire(["vs/editor/editor.main"], () => {
          const monaco = globals.monaco;
          if (monaco) resolve(monaco);
          else reject(new Error("The editor loaded but exposed no API"));
        });
      })
    )
    .catch((error) => {
      // Not cached as a rejected promise: a transient network failure should
      // not leave the frame permanently unable to retry.
      loading = undefined;
      throw error;
    });

  return loading;
}
