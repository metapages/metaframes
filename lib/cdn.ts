// Loading browser builds of libraries that cannot be bundled.
//
// Some libraries only ship a browser build as a classic script that assigns a
// global, or pull Node built-ins into their module entry so a bundler cannot
// touch them. Molstar is both: `molstar/lib/apps/viewer/app.js` imports
// node:crypto, node:fs and node:path, while `build/viewer/molstar.js` is a
// self-contained IIFE. Pyodide ships only a classic script.
//
// Fetching these at runtime also keeps them out of the frame's first load,
// which is the rule in the README: a frame downloads its heavy dependency when
// it is actually used.

const scripts = new Map<string, Promise<void>>();
const stylesheets = new Set<string>();

/** Load a classic script once per page, resolving when it has run. */
export function loadScriptOnce(src: string): Promise<void> {
  const existing = scripts.get(src);
  if (existing) return existing;

  const promise = new Promise<void>((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const script = document.createElement("script");
    script.src = src;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(script);
  });
  scripts.set(src, promise);
  return promise;
}

/**
 * Add a stylesheet once per page. Not awaited: a late stylesheet restyles what
 * is already on screen, and blocking on it would delay the view for nothing.
 */
export function loadStylesheetOnce(href: string): void {
  if (stylesheets.has(href)) return;
  stylesheets.add(href);
  if (document.querySelector(`link[href="${href}"]`)) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = href;
  document.head.appendChild(link);
}
