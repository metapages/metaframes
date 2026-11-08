import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import {
  getHashParamFromWindow,
  getHashParamValueBooleanFromWindow,
  getHashParamValueFloatFromWindow,
  getHashParamValueJsonFromWindow,
  setHashParamInWindow,
  setHashParamValueBooleanInWindow,
  setHashParamValueFloatInWindow,
  setHashParamValueJsonInWindow,
} from "@metapages/hash-query";

/**
 * How a field is encoded in the hash.
 *
 * `strings` is a JSON array of strings — the shape the published editor used
 * for its CSS URL list, kept so existing URLs keep working.
 */
export type HashParamKind = "string" | "boolean" | "number" | "strings";

export interface HashParamField {
  name: string;
  kind?: HashParamKind;
}

export type HashParamValues = Record<
  string,
  string | boolean | number | string[] | undefined
>;

const IS_BROWSER = typeof document !== "undefined";

function read(fields: HashParamField[]): HashParamValues {
  const values: HashParamValues = {};
  for (const { name, kind } of fields) {
    values[name] = kind === "boolean"
      ? getHashParamValueBooleanFromWindow(name)
      : kind === "number"
      ? getHashParamValueFloatFromWindow(name)
      : kind === "strings"
      ? getHashParamValueJsonFromWindow<string[]>(name)
      : getHashParamFromWindow(name);
  }
  return values;
}

/**
 * Several top-level hash params at once, by name.
 *
 * For code whose set of params is data rather than literals — the settings
 * form, which renders whatever a frame declares. One hook and one
 * subscription, because a hook per field would make the hook count depend on
 * configuration.
 *
 * Reads and writes go through @metapages/hash-query; the `hashchange`
 * subscription mirrors what the module's own useHashParam does, since it
 * exposes no per-key listener for plain strings.
 */
export function useHashParamSet(
  fields: HashParamField[],
): [HashParamValues, (values: HashParamValues) => void] {
  // A stable description of the fields, so the effect below does not resubscribe
  // whenever the caller rebuilds the array.
  const signature = fields.map((f) => `${f.name}:${f.kind ?? "string"}`).join(
    ",",
  );
  const fieldsRef = useRef(fields);
  fieldsRef.current = fields;

  const [values, setValues] = useState<HashParamValues>(() =>
    IS_BROWSER ? read(fields) : {}
  );
  const current = useRef(values);
  current.current = values;

  useEffect(() => {
    if (!IS_BROWSER || !signature) return;
    const update = () => {
      const next = read(fieldsRef.current);
      // Keep the previous object when nothing changed: this is read on every
      // hash write, and a new identity each time would re-render the form.
      if (JSON.stringify(current.current) === JSON.stringify(next)) return;
      current.current = next;
      setValues(next);
    };
    update();
    globalThis.addEventListener("hashchange", update);
    return () => globalThis.removeEventListener("hashchange", update);
  }, [signature]);

  const write = useCallback((next: HashParamValues) => {
    for (const { name, kind } of fieldsRef.current) {
      const value = next[name];
      // An empty value removes the param rather than writing a blank one, so
      // shared URLs stay free of noise.
      const unset = value === undefined || value === "" || value === null ||
        (Array.isArray(value) && value.length === 0);
      if (kind === "strings") {
        setHashParamValueJsonInWindow<string[] | undefined>(
          name,
          unset ? undefined : (value as string[]),
        );
      } else if (kind === "boolean") {
        setHashParamValueBooleanInWindow(
          name,
          unset || value === false ? undefined : true,
        );
      } else if (kind === "number") {
        const n = typeof value === "number" ? value : parseFloat(String(value));
        setHashParamValueFloatInWindow(
          name,
          unset || Number.isNaN(n) ? undefined : n,
        );
      } else {
        setHashParamInWindow(name, unset ? undefined : String(value));
      }
    }
  }, []);

  return [values, write];
}
