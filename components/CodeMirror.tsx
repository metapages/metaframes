import { useEffect, useRef } from "preact/hooks";
import { EditorView, keymap } from "@codemirror/view";
import { Compartment, EditorState } from "@codemirror/state";
import { indentWithTab } from "@codemirror/commands";
import { basicSetup } from "codemirror";
import type { Extension } from "@codemirror/state";

/**
 * Languages are loaded on demand so a frame only ships the grammar it uses.
 * Add an entry as a frame needs it (python for pyodide, json, etc).
 */
const LANGUAGES: Record<string, () => Promise<Extension>> = {
  markdown: () => import("@codemirror/lang-markdown").then((m) => m.markdown()),
};

/** A key of LANGUAGES. An unknown language yields a plain-text editor. */
export type Language = string;

interface Props {
  value: string;
  language: Language;
  onChange: (value: string) => void;
  class?: string;
}

// A self-contained CodeMirror 6 editor. Replaces the previously-embedded remote
// Monaco metaframe. Client-only (islands never SSR their effects).
export function CodeMirror({ value, language, onChange, class: cls }: Props) {
  const parent = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Create the editor once. The language grammar is loaded asynchronously, so
  // the editor may be created before it arrives; it is appended when ready.
  useEffect(() => {
    if (!parent.current) return;
    let disposed = false;

    // A compartment so the grammar can be swapped in once it has loaded,
    // without rebuilding the editor and losing cursor/undo state.
    const languageCompartment = new Compartment();

    const state = EditorState.create({
      doc: value,
      extensions: [
        basicSetup,
        keymap.of([indentWithTab]),
        languageCompartment.of([]),
        EditorView.updateListener.of((u) => {
          if (u.docChanged) onChangeRef.current(u.state.doc.toString());
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
    if (load) {
      load()
        .then((extension) => {
          if (disposed) return;
          editor.dispatch({
            effects: languageCompartment.reconfigure(extension),
          });
        })
        .catch(() => {
          // No syntax highlighting; a plain-text editor still works.
        });
    }

    return () => {
      disposed = true;
      editor.destroy();
      view.current = null;
    };
    // The language is fixed per mount; `value` is handled by the effect below.
  }, []);

  // Sync external value changes (e.g. hash updated elsewhere) into the editor
  // without disturbing the cursor when the value already matches.
  useEffect(() => {
    const v = view.current;
    if (!v) return;
    const current = v.state.doc.toString();
    if (value !== current) {
      v.dispatch({
        changes: { from: 0, to: current.length, insert: value },
      });
    }
  }, [value]);

  return <div ref={parent} class={cls ?? "w-full h-full overflow-auto"} />;
}
