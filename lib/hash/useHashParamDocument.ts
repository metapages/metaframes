import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import { useHashParamBase64 } from "./useHashParam.ts";

/**
 * How long after the last keystroke a document is written to the hash.
 *
 * The hash is shareable state, not a keystroke log: writing it per keystroke
 * rewrites the URL and wakes every subscriber on the page. Rendering does not
 * wait for it — local state drives that immediately — so the delay is
 * invisible while typing. framejs.io debounces its code commits for the same
 * reason.
 */
export const DOCUMENT_COMMIT_DEBOUNCE_MS = 500;

export interface HashParamDocument {
  /** The current text. */
  value: string;
  /**
   * Edited in this frame: renders on this keystroke, reaches the hash once
   * typing pauses.
   */
  edit: (next: string) => void;
  /**
   * Arrived from somewhere else — a metaframe input, a fetched URL. Renders
   * immediately and is NOT written back to the hash.
   */
  replace: (next: string) => void;
}

/**
 * A document held in a base64 hash param and edited live.
 *
 * Every frame with an editor needs the same three things, and getting any of
 * them wrong is invisible until someone complains that typing feels broken:
 *
 * - render from local state immediately, so the view never waits on the URL;
 * - debounce the hash write, so typing does not rewrite the URL per keystroke;
 * - ignore the debounced write coming back, or it lands as an "external"
 *   change and fights whatever has been typed since.
 *
 * Pair it with `components/CodeMirror.tsx`, which guards the other direction:
 * it refuses to let the echo of its own edit overwrite the buffer.
 */
export function useHashParamDocument(
  key: string,
  debounceMs: number = DOCUMENT_COMMIT_DEBOUNCE_MS,
): HashParamDocument {
  const [stored, setStored] = useHashParamBase64(key);
  const [value, setValue] = useState(stored);

  /**
   * Text this frame authored and has not yet seen echoed back out of the hash.
   */
  const localRef = useRef<string | null>(null);
  const commitTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  const edit = useCallback((next: string) => {
    localRef.current = next;
    setValue(next);
    clearTimeout(commitTimer.current);
    commitTimer.current = setTimeout(
      () => setStored(next === "" ? undefined : next),
      debounceMs,
    );
  }, [setStored, debounceMs]);

  const replace = useCallback((next: string) => {
    localRef.current = null;
    setValue(next);
  }, []);

  // Do not strand an unwritten edit if the editor closes mid-debounce.
  useEffect(() => () => clearTimeout(commitTimer.current), []);

  // The hash changed. Act on it unless it is our own debounced write coming
  // back, which would replace anything typed in the meantime.
  useEffect(() => {
    if (stored === localRef.current) return;
    localRef.current = null;
    setValue(stored);
  }, [stored]);

  return { value, edit, replace };
}
