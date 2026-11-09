import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "preact/hooks";
import { FrameShell } from "../../../components/FrameShell.tsx";
import { MonacoEditor } from "../../../components/MonacoEditor.tsx";
import type { HelpConfig } from "../../../lib/help.ts";
import { frameBaseUrl } from "../../../lib/host.ts";
import { useHashParamJson } from "../../../lib/hash/useHashParam.ts";
import { useHashParamDocument } from "../../../lib/hash/useHashParamDocument.ts";
import {
  monacoThemeFor,
  useResolvedColorScheme,
} from "../../../lib/hash/useColorScheme.ts";
import {
  useMetaframeInputs,
  useSetMetaframeOutputs,
} from "../../../lib/metaframe/useMetaframe.ts";
import { resolveLanguage } from "../../../lib/monaco/extensionToLanguage.ts";
import { outputPayload } from "../../../lib/metaframe/outputPayload.ts";
import { toText } from "../../../lib/metaframe/toText.ts";
import {
  DEFAULT_LANGUAGE,
  LANGUAGES,
  options,
  toolbar,
  wordmark,
} from "../config.ts";

/**
 * The published options contract, unchanged (llms-full.txt §4). Every boolean
 * is absent-means-false.
 */
interface EditorOptions {
  mode?: string;
  readOnly?: boolean;
  autosend?: boolean;
  saveloadinhash?: boolean;
  wordWrap?: boolean;
  hideLineNumbers?: boolean;
  autoFocus?: boolean;
  blockLocalEditorStateOverwrites?: boolean;
  /** The colour scheme; read by the shell, not here. See config.ts. */
  theme?: string;
}

/** Module-level, so an absent param hands back the same object every render. */
const NO_OPTIONS: EditorOptions = {};

/** The default pipe name, in and out, when nothing else arrives. */
const DEFAULT_PIPE = "text";

export function EditorView({ help }: { help: HelpConfig }) {
  const [opts] = useHashParamJson<EditorOptions>("options", NO_OPTIONS);
  const scheme = useResolvedColorScheme();
  const inputs = useMetaframeInputs();
  const setOutputs = useSetMetaframeOutputs();

  const autosend = !!opts?.autosend;
  const saveInHash = !!opts?.saveloadinhash;
  const readOnly = !!opts?.readOnly;

  /**
   * Typing reaches the URL only with BOTH flags, which is what the published
   * app does: the hash write sits inside its `autosend` branch. Without
   * `autosend` the URL changes when Save is pressed and not before, so an
   * embed's link stays the link it was given.
   */
  const doc = useHashParamDocument("text", {
    persist: autosend && saveInHash,
  });

  /**
   * The pipe to read and write. Starts as `text`; if a metapage sends on a
   * differently named pipe, that name takes over both directions — the
   * published behaviour, and what makes the editor droppable into a graph
   * whose pipes are named for the data rather than for this frame.
   */
  const pipe = useRef(DEFAULT_PIPE);

  /** Set once something has been typed here, for `blockLocalEditorStateOverwrites`. */
  const touched = useRef(false);

  /** The last text taken from an input pipe, so the same value is not re-applied. */
  const lastInput = useRef<unknown>(undefined);

  const language = useMemo(
    () => resolveLanguage(opts?.mode ?? DEFAULT_LANGUAGE, LANGUAGES),
    [opts?.mode],
  );

  // Monaco is served from this frame's own origin, which differs between the
  // two URL forms (editor.mtfm.io vs mtfm.io/editor). Resolved in the browser,
  // where `location` is authoritative — the same reason lib/help.ts does.
  const [base, setBase] = useState<string | null>(null);
  useEffect(() => setBase(frameBaseUrl("editor", "editor")), []);

  /** Send the text downstream, parsed when the published rule says so. */
  const emit = useCallback((text: string) => {
    setOutputs({ [pipe.current]: outputPayload(text, language) });
  }, [language, setOutputs]);

  const onEdit = useCallback((next: string) => {
    touched.current = true;
    doc.edit(next);
    if (autosend) emit(next);
  }, [doc.edit, autosend, emit]);

  const onSave = useCallback(() => {
    if (saveInHash) {
      // Writing the hash emits, through the effect below, so this is one path
      // rather than two that could disagree.
      doc.commit();
    } else {
      emit(doc.value ?? "");
    }
  }, [saveInHash, doc.commit, doc.value, emit]);

  /**
   * The document as the URL holds it: on load, and whenever the hash changes
   * under us. Emitted either way, so a metapage downstream of this editor
   * receives the starting document without anyone pressing anything — the
   * published app does the same.
   *
   * `doc.stored`, not `doc.value`: the latter changes on every keystroke, and
   * emitting from there would make every editor an `autosend` editor.
   */
  useEffect(() => {
    if (doc.stored === undefined) return;
    emit(doc.stored);
  }, [doc.stored, emit]);

  // Values arriving from the metapage.
  useEffect(() => {
    const names = Object.keys(inputs ?? {});
    if (names.length === 0) return;
    pipe.current = names[0];
    const incoming = inputs[pipe.current];
    if (incoming === undefined || incoming === null) return;
    if (incoming === lastInput.current) return;
    lastInput.current = incoming;

    if (opts?.blockLocalEditorStateOverwrites && touched.current) return;

    let cancelled = false;
    toText(incoming).then((text) => {
      if (cancelled || text === undefined) return;
      doc.replace(text);
      if (autosend) emit(text);
    }).catch(() => {
      // An unreachable dataref or an unreadable blob: leave the document as
      // it is rather than blanking the editor.
    });
    return () => {
      cancelled = true;
    };
  }, [inputs, opts?.blockLocalEditorStateOverwrites, autosend, emit]);

  // Only when an explicit Save is the way text leaves this frame. Read-only
  // has nothing to save; autosend has already sent it.
  const showSave = !autosend && !readOnly;

  return (
    <FrameShell
      wordmark={wordmark}
      title="Editor"
      help={help}
      options={options}
      toolbar={toolbar}
    >
      <div class="flex h-full w-full flex-col">
        {showSave && (
          <div class="flex shrink-0 items-center gap-2 border-b border-line px-2 py-1.5">
            <button
              type="button"
              class="btn btn-secondary px-3 py-1.5"
              onClick={onSave}
              title={saveInHash
                ? "Write the text into this page's URL"
                : "Send the text to whatever this frame is connected to"}
            >
              Save
            </button>
          </div>
        )}
        {base
          ? (
            <MonacoEditor
              class="min-h-0 flex-1"
              base={base}
              value={doc.value ?? ""}
              language={language}
              theme={monacoThemeFor(scheme)}
              onChange={onEdit}
              readOnly={readOnly}
              hideLineNumbers={opts?.hideLineNumbers}
              wordWrap={opts?.wordWrap}
              autoFocus={opts?.autoFocus}
            />
          )
          : <div class="min-h-0 flex-1" />}
      </div>
    </FrameShell>
  );
}
