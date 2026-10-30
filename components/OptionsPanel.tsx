import { useCallback, useEffect, useMemo, useState } from "preact/hooks";
import type { FrameOption } from "../lib/registry.ts";
import { useHashParamJson } from "../lib/hash/useHashParam.ts";
import {
  type HashParamField,
  useHashParamSet,
} from "../lib/hash/useHashParams.ts";

export type OptionValues = Record<
  string,
  string | boolean | number | undefined
>;

/**
 * Expand `suboptions`: choosing a value in a `type: "option"` select reveals
 * that branch's extra fields.
 */
function expand(options: FrameOption[], chosen: OptionValues): FrameOption[] {
  let out = options.concat();
  for (const option of options) {
    if (option.type !== "option" || !option.suboptions) continue;
    const value = chosen[option.name];
    const branch = typeof value === "string"
      ? option.suboptions[value]
      : undefined;
    if (branch) out = out.concat(branch);
  }
  return out;
}

/** Every option, including those nested under suboptions. */
function flatten(options: FrameOption[]): FrameOption[] {
  let out = options.concat();
  for (const option of options) {
    if (!option.suboptions) continue;
    for (const branch of Object.values(option.suboptions)) {
      out = out.concat(branch);
    }
  }
  return out;
}

function coerce(
  option: FrameOption | undefined,
  value: string | boolean | number,
): string | boolean | number {
  if (option?.map) return option.map(value);
  if (option?.type === "boolean") {
    return value === true || value === "1" || value === "true";
  }
  if (option?.type === "number") {
    return typeof value === "string" ? parseFloat(value) : value;
  }
  return value;
}

/**
 * The shared settings panel: a form generated from a frame's `FrameOption[]`
 * and persisted into a single JSON hash param.
 *
 * The framejs.io editor writes one hand-rolled component per setting
 * (EditBgColor, EditEditorWidth, …). With ~30 frames to migrate that does not
 * scale, so a frame declares its settings as data and this renders them in the
 * same blueprint vocabulary: hairline-divided rows, mono eyebrow labels.
 *
 * Edits stay local until applied. A form that rewrote the URL on every
 * keystroke would make the hash — which is the frame's shareable state —
 * unusable as a history.
 *
 * Most fields travel together inside one JSON hash param. A field marked
 * `hashParam` gets its own top-level param instead, for values that are part
 * of what the frame *is* — molstar's `pdbId` sits in the URL beside markdown's
 * `md`, so it reads and shares like the subject it is.
 */
export function OptionsPanel(
  { options, hashKey = "options" }: {
    options: FrameOption[];
    hashKey?: string;
  },
) {
  const defaults = useMemo(
    () =>
      Object.fromEntries(
        options
          .filter((o) => o.default !== undefined)
          .map((o) => [o.name, o.default!]),
      ) as OptionValues,
    [options],
  );

  const all = useMemo(() => flatten(options), [options]);

  /** Fields with their own top-level hash param, and the rest. */
  const ownParams = useMemo<HashParamField[]>(
    () =>
      all.filter((o) => o.hashParam).map((o) => ({
        name: o.name,
        kind: o.type === "boolean"
          ? "boolean" as const
          : o.type === "number"
          ? "number" as const
          : "string" as const,
      })),
    [all],
  );
  const blobDefaults = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(defaults).filter(([name]) =>
          !all.find((o) => o.name === name)?.hashParam
        ),
      ) as OptionValues,
    [defaults, all],
  );

  const [stored, setStored] = useHashParamJson<OptionValues>(
    hashKey,
    blobDefaults,
  );
  const [ownValues, setOwnValues] = useHashParamSet(ownParams);
  const [draft, setDraft] = useState<OptionValues>({
    ...stored,
    ...ownValues,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState(false);

  const visible = useMemo(() => expand(options, draft), [options, draft]);

  // A standalone param can change from outside the form (the URL, another
  // frame). Reflect that, unless the user has unapplied edits to lose.
  useEffect(() => {
    if (dirty) return;
    setDraft((previous) => ({ ...previous, ...ownValues }));
  }, [ownValues, dirty]);

  const onChange = useCallback((name: string, raw: string | boolean) => {
    const option = all.find((o) => o.name === name);
    setDraft((previous) => ({
      ...previous,
      [name]: option?.type === "boolean" ? raw === true || raw === "1" : raw,
    }));
    setDirty(true);
  }, [all]);

  const apply = useCallback(() => {
    const found: Record<string, string> = {};
    for (const [key, value] of Object.entries(draft)) {
      if (value === undefined) continue;
      const option = all.find((o) => o.name === key);
      if (!option?.validator || option.type === "boolean") continue;
      const error = option.validator(value);
      if (error) found[key] = error;
    }
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    const blob: OptionValues = {};
    const own: OptionValues = {};
    for (const [key, value] of Object.entries(draft)) {
      const option = all.find((o) => o.name === key);
      if (option?.hashParam) {
        // Kept even when empty: an empty value means "remove this param".
        own[key] = value === undefined || value === ""
          ? undefined
          : coerce(option, value);
        continue;
      }
      if (value === undefined) continue;
      blob[key] = coerce(option, value);
    }
    setStored(blob);
    if (ownParams.length > 0) setOwnValues(own);
    setDirty(false);
  }, [draft, all, ownParams, setStored, setOwnValues]);

  const reset = useCallback(() => {
    // Standalone params with no default are cleared rather than left behind.
    setDraft({
      ...Object.fromEntries(ownParams.map((f) => [f.name, undefined])),
      ...defaults,
    });
    setErrors({});
    setDirty(true);
  }, [defaults, ownParams]);

  return (
    <div class="flex h-full flex-col">
      <div class="min-h-0 flex-1 overflow-y-auto">
        <p class="px-6 pt-5 pb-4 text-sm text-ink-2">
          Settings are stored in the URL, so a configured frame is shareable and
          embeddable as it stands.
        </p>
        <div class="border-t border-line">
          {visible.map((option) => (
            <div
              key={option.name}
              class="flex flex-col gap-2 border-b border-line px-6 py-4"
            >
              <label class="eyebrow" for={`option-${option.name}`}>
                {option.displayName || option.name}
              </label>
              <OptionInput
                option={option}
                value={draft[option.name]}
                onChange={onChange}
              />
              {errors[option.name] && (
                <span class="text-sm text-danger">{errors[option.name]}</span>
              )}
            </div>
          ))}
        </div>
      </div>
      <div class="flex shrink-0 items-center gap-2 border-t border-line bg-surface-2 px-6 py-3">
        <button
          type="button"
          onClick={apply}
          disabled={!dirty}
          class="btn btn-primary"
        >
          Apply
        </button>
        <button type="button" onClick={reset} class="btn btn-secondary">
          Reset to defaults
        </button>
      </div>
    </div>
  );
}

function OptionInput(
  { option, value, onChange }: {
    option: FrameOption;
    value: string | boolean | number | undefined;
    onChange: (name: string, value: string | boolean) => void;
  },
) {
  const id = `option-${option.name}`;

  if (option.type === "option") {
    return (
      <select
        id={id}
        name={option.name}
        class="field max-w-xs"
        value={value === undefined ? "" : String(value)}
        onChange={(e) => onChange(option.name, e.currentTarget.value)}
      >
        {option.options?.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    );
  }

  if (option.type === "boolean") {
    const on = value === true || value === "1" || value === "true";
    return (
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={on}
        onClick={() => onChange(option.name, !on)}
        class={`relative h-5 w-9 shrink-0 rounded-full border transition-colors duration-150 ${
          on ? "border-accent bg-accent" : "border-line-strong bg-surface"
        }`}
      >
        <span
          class={`absolute top-0.5 h-3.5 w-3.5 rounded-full transition-all duration-150 ${
            on ? "left-[18px] bg-on-accent" : "left-0.5 bg-line-strong"
          }`}
        />
      </button>
    );
  }

  return (
    <input
      id={id}
      type={option.type === "number" ? "number" : "text"}
      name={option.name}
      class="field max-w-xs font-mono text-sm"
      value={value === undefined ? "" : String(value)}
      onInput={(e) => onChange(option.name, e.currentTarget.value)}
    />
  );
}
