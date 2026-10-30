// Loads Pyodide from the CDN (not bundled) and returns a ready instance with
// the /inputs and /outputs directories created and micropip/ssl/setuptools
// preloaded — matching the original metaframe-pyodide runtime.

import { loadScriptOnce } from "./cdn.ts";

const PYODIDE_VERSION = "0.24.1";
const PYODIDE_URL =
  `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/pyodide.js`;

// deno-lint-ignore no-explicit-any
type Pyodide = any;

let pyodidePromise: Promise<Pyodide> | undefined;

export function loadPyodideOnce(
  onLog?: (s: string) => void,
): Promise<Pyodide> {
  if (pyodidePromise) return pyodidePromise;
  pyodidePromise = (async () => {
    await loadScriptOnce(PYODIDE_URL);
    // deno-lint-ignore no-explicit-any
    const loadPyodide = (globalThis as any).loadPyodide;
    const pyodide = await loadPyodide();
    pyodide.setDebug(true);
    for (const pkg of ["micropip", "ssl", "setuptools"]) {
      await pyodide.loadPackage(pkg, onLog);
    }
    try {
      pyodide.FS.mkdir("/inputs");
    } catch { /* already exists */ }
    try {
      pyodide.FS.mkdir("/outputs");
    } catch { /* already exists */ }
    return pyodide;
  })();
  return pyodidePromise;
}
