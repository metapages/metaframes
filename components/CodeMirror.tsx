import { useEffect, useRef, useState } from "preact/hooks";
// Types only — `import type` is erased, so none of CodeMirror reaches the
// bundle from here. The real modules are imported dynamically below.
import type { EditorView as EditorViewType } from "@codemirror/view";
import type { Extension } from "@codemirror/state";
import { createEchoGuard } from "../lib/editorEcho.ts";

/**
 * Language grammars, loaded on demand so a frame only ever fetches the one it
 * uses. Add an entry as a frame needs it (python for pyodide, json, …).
 */
const LANGUAGES: Record<string, () => Promise<Extension>> = {
  markdown: () => import("@codemirror/lang-markdown").then((m) => m.markdown()),
  python: () => import("@codemirror/lang-python").then((m) => m.python()),
};

/** A key of LANGUAGES. An unknown language yields a plain-text editor. */
export type Language = string;

interface Props {
  value: string;
  language: Language;
  onChange: (value: string) => void;
  class?: string;
}

/**
 * A CodeMirror 6 editor that is not in any frame's initial download.
 *
 * Every CodeMirror import here is dynamic, so Vite splits the editor into its
 * own chunk and the browser fetches it only when this component actually
 * mounts. A frame whose editor is behind a toggle (markdown's `edit`) ships
 * none of it until the toggle is on — the same shape as framejs.io, whose page
 * is small and loads the editor separately.
 *
 * Client-only: islands never run their effects during SSR.
 */
export function CodeMirror({ value, language, onChange, class: cls }: Props) {
  const parent = useRef<HTMLDivElement>(null);
  const view = useRef<EditorViewType | null>(null);
  // Kept in refs so the async setup below always sees current values without
  // re-running: the editor is created once.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const valueRef = useRef(value);
  valueRef.current = value;
  /**
   * Tells our own echo apart from a real outside change.
   *
   * It has to remember every emission still outstanding, not just the last
   * one: with a single remembered value, two keystrokes inside one render
   * batch send this and its caller into an endless exchange that locks up the
   * tab. See lib/editorEcho.ts.
   */
  const echo = useRef(createEchoGuard());

  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!parent.current) return;
    let disposed = false;

    (async () => {
      let modules;
      try {
        modules = await Promise.all([
          import("@codemirror/view"),
          import("@codemirror/state"),
          import("@codemirror/commands"),
          import("codemirror"),
        ]);
      } catch {
        // Offline, or the chunk failed to load. The frame still works; the
        // fallback textarea below takes over.
        if (!disposed) setFailed(true);
        return;
      }
      if (disposed || !parent.current) return;

      const [
        { EditorView, keymap },
        { Compartment, EditorState },
        { indentWithTab },
        { basicSetup },
      ] = modules;

      // A compartment so the grammar can be swapped in once it has loaded,
      // without rebuilding the editor and losing cursor/undo state.
      const languageCompartment = new Compartment();

      const state = EditorState.create({
        // valueRef, not `value`: the document may have changed while the
        // editor chunk was in flight.
        doc: valueRef.current,
        extensions: [
          basicSetup,
          keymap.of([indentWithTab]),
          languageCompartment.of([]),
          EditorView.updateListener.of((u) => {
            if (!u.docChanged) return;
            const text = u.state.doc.toString();
            echo.current.emitted(text);
            onChangeRef.current(text);
          }),
          EditorView.theme({
            "&": { height: "100%" },
            ".cm-scroller": { overflow: "auto" },
          }),
        ],
      });
      const editor = new EditorView({ state, parent: parent.current });
      view.current = editor;

      const load = LANGUAGES[language];
      if (!load) return;
      try {
        const extension = await load();
        if (disposed) return;
        editor.dispatch({
          effects: languageCompartment.reconfigure(extension),
        });
      } catch {
        // No syntax highlighting; a plain-text editor still works.
      }
    })();

    return () => {
      disposed = true;
      view.current?.destroy();
      view.current = null;
    };
    // The language is fixed per mount; `value` is handled by the effect below.
  }, []);

  // Sync external value changes (e.g. the hash updated elsewhere) into the
  // editor, leaving the cursor alone when the text already matches.
  useEffect(() => {
    const v = view.current;
    if (!v) return;
    const current = v.state.doc.toString();
    if (!echo.current.isExternal(value, current)) return;
    v.dispatch({ changes: { from: 0, to: current.length, insert: value } });
  }, [value]);

  if (failed) {
    return (
      <textarea
        class={`${
          cls ?? "h-full w-full"
        } resize-none border-0 bg-surface p-3 font-mono text-[0.8125rem] text-ink outline-none`}
        value={value}
        onInput={(e) => onChange(e.currentTarget.value)}
      />
    );
  }

  return <div ref={parent} class={cls ?? "h-full w-full overflow-auto"} />;
}
