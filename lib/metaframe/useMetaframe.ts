import { useCallback, useEffect, useState } from "preact/hooks";
import type { MetaframeInputMap } from "@metapages/metapage";
import { getMetaframe, type Metaframe } from "./metaframe.ts";

const IS_BROWSER = typeof document !== "undefined";

/** The page's Metaframe instance (undefined during SSR / the first render). */
export function useMetaframe(): Metaframe | undefined {
  const [mf, setMf] = useState<Metaframe | undefined>(undefined);
  useEffect(() => {
    if (IS_BROWSER) setMf(getMetaframe());
  }, []);
  return mf;
}

/**
 * The metaframe's current inputs, kept up to date as the parent metapage pushes
 * new values. Values accumulate: a pipe that is not in an update keeps its
 * previous value, which is what the metapage input semantics imply.
 *
 * Returns an empty object until connected.
 */
export function useMetaframeInputs(): MetaframeInputMap {
  const mf = useMetaframe();
  const [inputs, setInputs] = useState<MetaframeInputMap>({});

  useEffect(() => {
    if (!mf) return;
    setInputs(mf.getInputs());
    const disposer = mf.onInputs((incoming) => {
      setInputs((previous) => ({ ...previous, ...incoming }));
    });
    return () => disposer();
  }, [mf]);

  return inputs;
}

/**
 * A stable setter for metaframe outputs, for event-driven output (a click, a
 * finished computation). No-ops when not running in a connected metaframe.
 */
export function useSetMetaframeOutputs(): (
  outputs: MetaframeInputMap,
) => void {
  const mf = useMetaframe();
  return useCallback((outputs: MetaframeInputMap) => {
    if (!mf) return;
    mf.setOutputs(outputs).catch(() => {
      // Not connected to a parent metapage; outputs have nowhere to go.
    });
  }, [mf]);
}

/**
 * Declaratively mirror a value to an output pipe: it is sent whenever `value`
 * changes. `undefined` is not sent, so a frame can wait for real content.
 */
export function useMetaframeOutput(key: string, value: unknown): void {
  const mf = useMetaframe();
  useEffect(() => {
    if (!mf || value === undefined) return;
    mf.setOutput(key, value);
  }, [mf, key, value]);
}
