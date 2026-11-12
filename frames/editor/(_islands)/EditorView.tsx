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

  const saveInHash = !!opts?.saveloadinhash;
  const readOnly = !!opts?.readOnly;

  /**
   * There is no Save button. An edit is saved the moment it is made: sent on
   * the output pipe always, and written into the URL when `saveloadinhash`
   * says the URL is where this document lives.
   *
   * The published app had a Save button, and an `autosend` option whose only
   * job was to replace it with live sending. A button that must be pressed
   * for work to count is a way to lose work — the frame is often an embed in
   * someone else's page, where nothing suggests a press is owed — so sending
   * is now the only behaviour and `autosend` describes nothing. It is still
   * accepted in a URL and ignored.
   */
  const doc = useHashParamDocument("text", { persist: saveInHash });

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
    emit(next);
  }, [doc.edit, emit]);

  /**
   * The document as the URL holds it: on load, and whenever the hash changes
   * under us. Emitted either way, so a metapage downstream of this editor
   * receives the starting document without anyone pressing anything — the
   * published app does the same.
   *
   * `doc.stored`, not `doc.value`: this is about the document the URL carries,
   * which is a different question from what has just been typed. Keystrokes
   * are emitted by `onEdit`.
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
      emit(text);
    }).catch(() => {
      // An unreachable dataref or an unreadable blob: leave the document as
      // it is rather than blanking the editor.
    });
    return () => {
      cancelled = true;
    };
  }, [inputs, opts?.blockLocalEditorStateOverwrites, emit]);

  return (
    <FrameShell
      wordmark={wordmark}
      title="Editor"
      help={help}
      options={options}
      toolbar={toolbar}
    >
      {
        /* The editor is the whole frame: nothing above it, nothing beside it,
          flush to the edges like every other renderer here. */
      }
      {base
        ? (
          <MonacoEditor
            class="h-full w-full"
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
        : <div class="h-full w-full" />}
    </FrameShell>
  );
}
