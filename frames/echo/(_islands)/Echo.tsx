import { useEffect } from "preact/hooks";
import { FrameShell } from "../../../components/FrameShell.tsx";
import { useHashParamBoolean } from "../../../lib/hash/useHashParam.ts";
import {
  useMetaframeInputs,
  useSetMetaframeOutputs,
} from "../../../lib/metaframe/useMetaframe.ts";
import { options } from "../options.ts";

export function Echo({ helpUrl }: { helpUrl: string }) {
  const inputs = useMetaframeInputs();
  const setOutputs = useSetMetaframeOutputs();
  const [debug] = useHashParamBoolean("debug");

  // The entire point of this frame.
  useEffect(() => {
    if (Object.keys(inputs).length === 0) return;
    setOutputs(inputs);
  }, [inputs, setOutputs]);

  return (
    <FrameShell
      title="Echo"
      helpUrl={helpUrl}
      options={options}
    >
      <div class="h-full overflow-auto p-3 font-mono text-sm">
        {debug
          ? (
            Object.keys(inputs).length === 0
              ? <span class="text-gray-400">No inputs yet</span>
              : (
                <pre class="whitespace-pre-wrap">{JSON.stringify(inputs, null, 2)}</pre>
              )
          )
          : (
            <span class="text-gray-400">
              Echoing {Object.keys(inputs).length} input(s). Set{" "}
              <code>debug</code> in Options to show them.
            </span>
          )}
      </div>
    </FrameShell>
  );
}
