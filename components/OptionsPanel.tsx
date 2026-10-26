import { useCallback, useMemo, useState } from "preact/hooks";
import type { FrameOption } from "../lib/registry.ts";
import { useHashParamJson } from "../lib/hash/useHashParam.ts";

export type OptionValues = Record<
  string,
  string | boolean | number | undefined
>;

/**
 * Expand `suboptions`: choosing a value in a `type: "option"` select reveals
 * that branch's extra fields.
 */
function expand(
  options: FrameOption[],
  chosen: OptionValues,
): FrameOption[] {
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
 * The shared Options tab: a declarative form over a frame's `FrameOption[]`
 * schema, persisted into a single JSON hash param (`options` by default).
 *
 * Edits are local until applied, which is how the metaframe this is ported
 * from behaved — an options form that rewrote the URL on every keystroke made
 * the hash unusable as an undo history.
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

  const [stored, setStored] = useHashParamJson<OptionValues>(hashKey, defaults);
  const [draft, setDraft] = useState<OptionValues>(stored ?? {});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState(false);

  const visible = useMemo(() => expand(options, draft), [options, draft]);
  const all = useMemo(() => flatten(options), [options]);

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

    const next: OptionValues = {};
    for (const [key, value] of Object.entries(draft)) {
      if (value === undefined) continue;
      next[key] = coerce(all.find((o) => o.name === key), value);
    }
    setStored(next);
    setDirty(false);
  }, [draft, all, setStored]);

  const reset = useCallback(() => {
    setDraft(defaults);
    setErrors({});
    setDirty(true);
  }, [defaults]);

  return (
    <div class="h-full overflow-auto p-4">
      <p class="mb-4 text-sm text-gray-500">
        Settings are stored in the URL, so the configured frame is shareable and
        embeddable as-is.
      </p>
      <div class="flex flex-col gap-3 max-w-xl">
        {visible.map((option) => (
          <label key={option.name} class="flex flex-col gap-1">
            <span class="text-sm font-medium text-gray-700">
              {option.displayName || option.name}
            </span>
            <OptionInput
              option={option}
              value={draft[option.name]}
              onChange={onChange}
            />
            {errors[option.name] && (
              <span class="text-sm text-red-600">{errors[option.name]}</span>
            )}
          </label>
        ))}
      </div>
      <div class="flex items-center gap-2 mt-5">
        <button
          type="button"
          onClick={apply}
          disabled={!dirty}
          class="px-3 py-1.5 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:hover:bg-blue-600"
        >
          Apply
        </button>
        <button
          type="button"
          onClick={reset}
          class="px-3 py-1.5 text-sm rounded-md border border-gray-300 hover:bg-gray-100"
        >
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
  const common =
    "px-2 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

  if (option.type === "option") {
    return (
      <select
        name={option.name}
        class={common}
        value={value === undefined ? "" : String(value)}
        onChange={(e) => onChange(option.name, e.currentTarget.value)}
      >
        {option.options?.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    );
  }

  if (option.type === "boolean") {
    return (
      <input
        type="checkbox"
        name={option.name}
        class="w-4 h-4"
        checked={value === true || value === "1" || value === "true"}
        onChange={(e) => onChange(option.name, e.currentTarget.checked)}
      />
    );
  }

  return (
    <input
      type={option.type === "number" ? "number" : "text"}
      name={option.name}
      class={common}
      value={value === undefined ? "" : String(value)}
      onInput={(e) => onChange(option.name, e.currentTarget.value)}
    />
  );
}
