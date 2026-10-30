import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "preact/hooks";
import { FrameShell } from "../../../components/FrameShell.tsx";
import { CodeMirror } from "../../../components/CodeMirror.tsx";
import type { HelpConfig } from "../../../lib/help.ts";
import { useHashParamJson } from "../../../lib/hash/useHashParam.ts";
import { useHashParamDocument } from "../../../lib/hash/useHashParamDocument.ts";
import { getMetaframe } from "../../../lib/metaframe/metaframe.ts";
import { useMetaframeInputs } from "../../../lib/metaframe/useMetaframe.ts";
import { loadPyodideOnce } from "../../../lib/pyodide.ts";
import { options, toolbar, wordmark } from "../config.ts";

interface Options {
  /** Re-run on new inputs: inputs become /inputs files, /outputs become outputs. */
  r?: boolean;
}

// deno-lint-ignore no-explicit-any
type Any = any;

/** Debounce before re-running, so typing does not restart Python per keystroke. */
const RUN_DEBOUNCE_MS = 500;

/**
 * Write metaframe inputs into the Pyodide filesystem at /inputs/<key>, with
 * the original runtime's type handling: typed arrays raw, objects as JSON.
 */
function saveInputsToPython(pyodide: Any, inputs: Record<string, unknown>) {
  if (!inputs || Object.keys(inputs).length === 0) return;
  const FS = pyodide.FS;
  for (const key of Object.keys(inputs)) {
    const value = inputs[key] as Any;
    if (ArrayBuffer.isView(value)) {
      const arr = value as Uint8Array;
      const stream = FS.open(`/inputs/${key}`, "w+");
      FS.write(stream, arr, 0, arr.length, 0);
      FS.close(stream);
    } else if (typeof value === "object" && value !== null) {
      FS.writeFile(`/inputs/${key}`, JSON.stringify(value), {
        encoding: "utf8",
      });
    } else {
      FS.writeFile(`/inputs/${key}`, String(value), { encoding: "utf8" });
    }
  }
}

export function PyodideRunner({ help }: { help: HelpConfig }) {
  // The script: renders now, reaches the hash when typing pauses.
  const doc = useHashParamDocument("py");
  const [viewOptions] = useHashParamJson<Options>("options", {});
  const metaframeInputs = useMetaframeInputs();
  const [ready, setReady] = useState(false);

  /**
   * The output pane, held in state rather than a ref: Python writes into this
   * node directly, so if it were ever replaced the effect below has to run
   * again. (The shell keeps the renderer mounted, but a frame should not have
   * to depend on that — see the README.)
   */
  const [output, setOutput] = useState<HTMLDivElement | null>(null);

  // Latest values, so the run function can stay stable.
  const codeRef = useRef(doc.value);
  codeRef.current = doc.value;
  const optionsRef = useRef(viewOptions);
  optionsRef.current = viewOptions;
  const outputRef = useRef<HTMLDivElement | null>(null);
  outputRef.current = output;
  const pyodideRef = useRef<Any>(null);

  const append = useCallback((text: string, cls: string) => {
    const root = outputRef.current;
    if (!root) return;
    const pre = document.createElement("pre");
    pre.textContent = text;
    pre.className = cls;
    root.appendChild(pre);
    root.scrollTop = root.scrollHeight;
  }, []);
  const logStdout = useCallback((s: string) => append(s, "pre-stdout"), [
    append,
  ]);
  const logStderr = useCallback((s: string) => append(s, "pre-stderr"), [
    append,
  ]);

  const run = useCallback(async () => {
    const pyodide = pyodideRef.current;
    if (!pyodide) return;
    // Give the previous script a chance to release proxied objects.
    const unload = (globalThis as Any).scriptUnload;
    if (unload) {
      try {
        unload();
      } catch (err) {
        console.error("Error in scriptUnload()", err);
      }
    }
    if (outputRef.current) outputRef.current.textContent = "";
    const py = codeRef.current;
    if (!py) return;
    try {
      // Install whatever the script imports before running it. Pyodide ships
      // numpy, pandas, matplotlib and the rest, but does not load any of them
      // until asked — without this, `import numpy as np` fails with a
      // ModuleNotFoundError telling the user to install it by hand. Unknown
      // imports are skipped here and fail at runtime as usual; packages that
      // are on PyPI but not in the distribution still need an explicit
      // `await micropip.install(...)`.
      await pyodide.loadPackagesFromImports(py, {
        messageCallback: logStdout,
        errorCallback: logStderr,
      });
      await pyodide.runPythonAsync(py);
      if (!optionsRef.current?.r) return;
      const FS = pyodide.FS;
      const files = FS.readdir("/outputs").filter((f: string) =>
        f !== "." && f !== ".."
      );
      if (files.length === 0) return;
      const outputs: Record<string, unknown> = {};
      for (const f of files) outputs[f] = FS.readFile(`/outputs/${f}`);
      getMetaframe().setOutputs(outputs);
    } catch (err) {
      logStderr(`${err}`);
    }
  }, [logStdout, logStderr]);

  const runRef = useRef(run);
  runRef.current = run;
  const runTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const scheduleRun = useCallback(() => {
    clearTimeout(runTimer.current);
    runTimer.current = setTimeout(() => runRef.current(), RUN_DEBOUNCE_MS);
  }, []);
  useEffect(() => () => clearTimeout(runTimer.current), []);

  // One-time setup: the globals user scripts expect
  // (`from js import metaframe, log, logStdout, logStderr`) and the runtime,
  // fetched from a CDN rather than bundled.
  useEffect(() => {
    const g = globalThis as Any;
    g.metaframe = getMetaframe();
    g.log = logStdout;
    g.logStdout = logStdout;
    g.logStderr = logStderr;
    g.metaframeInputs = g.metaframeInputs ?? {};

    let cancelled = false;
    loadPyodideOnce(logStdout)
      .then((pyodide) => {
        if (cancelled) return;
        pyodideRef.current = pyodide;
        g.pyodideInstance = pyodide;
        pyodide.setStdout({ batched: logStdout });
        pyodide.setStderr({ batched: logStderr });
        if (optionsRef.current?.r) {
          saveInputsToPython(pyodide, g.metaframeInputs);
        }
        setReady(true);
      })
      .catch((err) => logStderr(`Failed to load Pyodide: ${err}`));

    return () => {
      cancelled = true;
    };
  }, [logStdout, logStderr]);

  // Run once ready, and again whenever the script changes.
  useEffect(() => {
    if (ready) scheduleRun();
  }, [doc.value, ready, scheduleRun]);

  // Re-run on new inputs, in "re-run" mode.
  useEffect(() => {
    const g = globalThis as Any;
    if (!optionsRef.current?.r) return;
    if (pyodideRef.current) {
      saveInputsToPython(pyodideRef.current, metaframeInputs);
      scheduleRun();
    } else {
      // The runtime is still loading; keep them for when it arrives.
      g.metaframeInputs = { ...g.metaframeInputs, ...metaframeInputs };
    }
  }, [metaframeInputs, scheduleRun]);

  const panels = useMemo(() => [{
    key: "editor",
    label: "editor",
    icon: "pencil" as const,
    content: (
      <CodeMirror value={doc.value} language="python" onChange={doc.edit} />
    ),
  }], [doc.value, doc.edit]);

  const actions = useMemo(() => [{
    key: "run",
    label: "run",
    icon: "play" as const,
    onClick: () => runRef.current(),
  }], []);

  return (
    <FrameShell
      wordmark={wordmark}
      title="Python"
      help={help}
      options={options}
      toolbar={toolbar}
      panels={panels}
      actions={actions}
    >
      <div class="relative h-full w-full bg-surface">
        {
          /* Python writes into this node directly, so it must have no
            Preact-managed children. `id="root"` is kept because user scripts
            reference document.getElementById("root"). */
        }
        <div
          ref={setOutput}
          id="root"
          class="absolute inset-0 overflow-auto p-3 font-mono text-[0.8125rem]"
        />
        {!ready && (
          <div class="pointer-events-none absolute left-3 top-3 flex items-center gap-2">
            <span class="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
            <span class="eyebrow">loading python…</span>
          </div>
        )}
      </div>
    </FrameShell>
  );
}
