import { useEffect } from "preact/hooks";
import { FrameShell } from "../../../components/FrameShell.tsx";
import type { HelpConfig } from "../../../lib/help.ts";
import { useHashParamBoolean } from "../../../lib/hash/useHashParam.ts";
import {
  useMetaframeInputs,
  useSetMetaframeOutputs,
} from "../../../lib/metaframe/useMetaframe.ts";
import { options, toolbar, wordmark } from "../config.ts";

export function Echo({ help }: { help: HelpConfig }) {
  const inputs = useMetaframeInputs();
  const setOutputs = useSetMetaframeOutputs();
  const [debug] = useHashParamBoolean("debug");
  const keys = Object.keys(inputs);

  // The entire point of this frame.
  useEffect(() => {
    if (keys.length === 0) return;
    setOutputs(inputs);
  }, [inputs, setOutputs]);

  return (
    <FrameShell
      wordmark={wordmark}
      title="Echo"
      help={help}
      options={options}
      toolbar={toolbar}
    >
      <div class="h-full overflow-auto p-4">
        <div class="flex items-center gap-2">
          <span
            class={`h-1.5 w-1.5 rounded-full ${
              keys.length ? "bg-good" : "bg-line-strong"
            }`}
          />
          <span class="eyebrow">
            {keys.length
              ? `echoing ${keys.length} input${keys.length > 1 ? "s" : ""}`
              : "waiting for inputs"}
          </span>
        </div>

        {debug
          ? (
            keys.length === 0
              ? (
                <p class="mt-4 text-sm text-ink-3">
                  Nothing has arrived yet. Connect this frame's input to another
                  frame's output in a metapage.
                </p>
              )
              : (
                <pre class="plate mt-4 overflow-auto p-3 font-mono text-[0.8125rem] leading-relaxed whitespace-pre-wrap text-ink">
{JSON.stringify(inputs, null, 2)}
                </pre>
              )
          )
          : (
            <p class="mt-4 text-sm text-ink-2">
              Every input is sent straight back out as an output. Turn on{" "}
              <span class="font-mono text-ink">Show inputs as JSON</span>{" "}
              in settings to see what is flowing through.
            </p>
          )}
      </div>
    </FrameShell>
  );
}
