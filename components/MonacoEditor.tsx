import { useEffect, useRef, useState } from "preact/hooks";
// Types only — erased at compile time, so no part of Monaco reaches any
// frame's bundle from this import. The runtime copy arrives via loadMonaco().
import type { editor as MonacoEditorApi } from "monaco-editor";
import { loadMonaco, type Monaco } from "../lib/monaco/loadMonaco.ts";
import { createEchoGuard } from "../lib/editorEcho.ts";

interface Props {
  value: string;
  /** A Monaco language id, e.g. `json`, `python`, `plaintext`. */
  language: string;
  /** Resolved scheme; mapped to a Monaco theme id by the caller. */
  theme: string;
  /** Where to load Monaco from — this frame's base URL. */
  base: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
  hideLineNumbers?: boolean;
  wordWrap?: boolean;
  autoFocus?: boolean;
  class?: string;
}

/**
 * Monaco, the editor behind VS Code, in a Preact island.
 *
 * Monaco is imperative and owns its own DOM, so this component creates it once
 * and then pushes prop changes in through its API. The container element is
 * never re-rendered by Preact, for the same reason the markdown frame's output
 * node is not: Monaco would lose the DOM it is holding.
 *
 * Client-only. Islands do not run effects during SSR, so nothing here is
 * reached on the server, where `document` does not exist.
 */
export function MonacoEditor({
  value,
  language,
  theme,
  base,
  onChange,
  readOnly,
  hideLineNumbers,
  wordWrap,
  autoFocus,
  class: cls,
}: Props) {
  const parent = useRef<HTMLDivElement>(null);
  const editor = useRef<MonacoEditorApi.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<Monaco | null>(null);

  // Read inside the async setup below, which runs once and must not re-run
  // just because a callback identity or the initial text changed.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const initial = useRef({ value, language, theme, readOnly, autoFocus });

  /** Tells our own echo apart from a real outside change; see lib/editorEcho.ts. */
  const echo = useRef(createEchoGuard());

  const [failed, setFailed] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!parent.current) return;
    let disposed = false;

    loadMonaco(base)
      .then((monaco) => {
        if (disposed || !parent.current) return;
        monacoRef.current = monaco;
        const start = initial.current;

        const instance = monaco.editor.create(parent.current, {
          value: start.value,
          language: start.language,
          theme: start.theme,
          readOnly: start.readOnly,
          // The published editor's settings, kept: a minimap in a frame that
          // is often only a few hundred pixels wide costs more than it gives.
          minimap: { enabled: false },
          lineNumbers: hideLineNumbers ? "off" : "on",
          wordWrap: wordWrap ? "on" : "off",
          scrollBeyondLastLine: false,
          // The frame is resized by the shell's draggable split and by
          // whatever embeds it. Without this Monaco keeps its first size and
          // renders into the wrong box, with no error.
          automaticLayout: true,
          fontFamily:
            'var(--font-mono, "IBM Plex Mono", ui-monospace, monospace)',
          // Flush to the frame's edges, like every other renderer here, except
          // for the gutter's own breathing room.
          padding: { top: 0, bottom: 0 },
        });
        editor.current = instance;

        instance.onDidChangeModelContent(() => {
          const next = instance.getValue();
          echo.current.emitted(next);
          onChangeRef.current(next);
        });

        if (start.autoFocus) instance.focus();
        setReady(true);
      })
      .catch((error: Error) => {
        if (!disposed) setFailed(error.message);
      });

    return () => {
      disposed = true;
      editor.current?.getModel()?.dispose();
      editor.current?.dispose();
      editor.current = null;
    };
  }, [base]);

  // Text that arrived from somewhere else — a metaframe input, the URL, a
  // different document. Our own echoes are dropped; see lib/editorEcho.ts.
  useEffect(() => {
    const instance = editor.current;
    if (!instance) return;

    if (!echo.current.isExternal(value, instance.getValue())) return;

    // Not setValue(): that resets undo history, so an incoming value would
    // destroy the user's ability to undo their own edits.
    const model = instance.getModel();
    if (!model) return;
    instance.executeEdits("external", [{
      range: model.getFullModelRange(),
      text: value ?? "",
    }]);
    instance.pushUndoStop();
  }, [value, ready]);

  useEffect(() => {
    const model = editor.current?.getModel();
    if (model && monacoRef.current) {
      monacoRef.current.editor.setModelLanguage(model, language);
    }
  }, [language, ready]);

  useEffect(() => {
    monacoRef.current?.editor.setTheme(theme);
  }, [theme, ready]);

  useEffect(() => {
    editor.current?.updateOptions({
      readOnly,
      lineNumbers: hideLineNumbers ? "off" : "on",
      wordWrap: wordWrap ? "on" : "off",
    });
  }, [readOnly, hideLineNumbers, wordWrap, ready]);

  if (failed) {
    return (
      <div
        class={`flex h-full w-full items-center justify-center p-4 ${
          cls ?? ""
        }`}
      >
        <p class="max-w-sm text-center text-sm text-danger">{failed}</p>
      </div>
    );
  }

  return <div ref={parent} class={`h-full w-full ${cls ?? ""}`} />;
}
