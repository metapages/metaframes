// Preact-native hooks over the framework-agnostic @metapages/hash-query core.
//
// We deliberately do NOT use @metapages/hash-query/react-hooks (it imports
// "react"). The core functions below produce the exact same on-the-wire hash
// format (`#<prefix>?key=value&...`, sorted keys, base64/JSON encoding), so
// every URL already published by the existing metaframes keeps working.
//
// The core dispatches a synthetic HashChangeEvent after it rewrites the hash
// with replaceState, so subscribing to "hashchange" also picks up writes made
// by this page.

import { useCallback, useEffect, useState } from "preact/hooks";
import {
  getHashParamFromWindow,
  getHashParamValueBase64DecodedFromWindow,
  getHashParamValueBooleanFromWindow,
  getHashParamValueFloatFromWindow,
  getHashParamValueIntFromWindow,
  getHashParamValueJsonFromWindow,
  setHashParamInWindow,
  type SetHashParamOpts,
  setHashParamValueBase64EncodedInWindow,
  setHashParamValueBooleanInWindow,
  setHashParamValueFloatInWindow,
  setHashParamValueIntInWindow,
  setHashParamValueJsonInWindow,
} from "@metapages/hash-query";

const IS_BROWSER = typeof document !== "undefined";

export type HashParamSetter<T> = (
  value: T | undefined,
  opts?: SetHashParamOpts,
) => void;

/**
 * Re-render whenever the hash changes, returning a version counter.
 *
 * For code that reads params whose keys are not known at compile time — the
 * shared shell interpreting a frame's declared `toolbar`, for instance, where
 * one hook per item would make the hook count depend on configuration. Read
 * values with the @metapages/hash-query getters; this only drives the update.
 */
export function useHashChange(): number {
  const [version, setVersion] = useState(0);
  useEffect(() => {
    if (!IS_BROWSER) return;
    const bump = () => setVersion((v) => v + 1);
    bump(); // the hash was not known during SSR
    globalThis.addEventListener("hashchange", bump);
    return () => globalThis.removeEventListener("hashchange", bump);
  }, []);
  return version;
}

/** Subscribe a reader to hashchange events and return its current value. */
function useHashValue<T>(read: () => T): T {
  const [value, setValue] = useState<T>(read);

  useEffect(() => {
    if (!IS_BROWSER) return;
    const update = () => setValue(read());
    update(); // sync once on mount (SSR produced the default)
    globalThis.addEventListener("hashchange", update);
    return () => globalThis.removeEventListener("hashchange", update);
  }, []);

  return value;
}

/** A plain string hash param, e.g. `hm`. */
export function useHashParam(
  key: string,
  defaultValue = "",
): [string, HashParamSetter<string>] {
  const value = useHashValue<string>(() =>
    getHashParamFromWindow(key) ?? defaultValue
  );
  const setValue = useCallback<HashParamSetter<string>>(
    (v, opts) => setHashParamInWindow(key, v, opts),
    [key],
  );
  return [value, setValue];
}

/** A base64-encoded string hash param, e.g. `md` / `py` / `text`. */
export function useHashParamBase64(
  key: string,
  defaultValue = "",
): [string, HashParamSetter<string>] {
  const value = useHashValue<string>(() =>
    getHashParamValueBase64DecodedFromWindow(key) ?? defaultValue
  );
  const setValue = useCallback<HashParamSetter<string>>(
    (v, opts) => setHashParamValueBase64EncodedInWindow(key, v, opts),
    [key],
  );
  return [value, setValue];
}

/** A JSON-encoded hash param, e.g. `options`. */
export function useHashParamJson<T>(
  key: string,
  defaultValue: T,
): [T, HashParamSetter<T>] {
  const value = useHashValue<T>(() => {
    const v = getHashParamValueJsonFromWindow<T>(key);
    return v === undefined ? defaultValue : v;
  });
  const setValue = useCallback<HashParamSetter<T>>(
    (v, opts) => setHashParamValueJsonInWindow(key, v, opts),
    [key],
  );
  return [value, setValue];
}

/** A boolean hash param, e.g. `debug` / `edit`. */
export function useHashParamBoolean(
  key: string,
  defaultValue = false,
): [boolean, HashParamSetter<boolean>] {
  const value = useHashValue<boolean>(() =>
    getHashParamValueBooleanFromWindow(key) ?? defaultValue
  );
  const setValue = useCallback<HashParamSetter<boolean>>(
    (v, opts) => setHashParamValueBooleanInWindow(key, v, opts),
    [key],
  );
  return [value, setValue];
}

/** An integer hash param. */
export function useHashParamInt(
  key: string,
  defaultValue?: number,
): [number | undefined, HashParamSetter<number>] {
  const value = useHashValue<number | undefined>(() =>
    getHashParamValueIntFromWindow(key) ?? defaultValue
  );
  const setValue = useCallback<HashParamSetter<number>>(
    (v, opts) => setHashParamValueIntInWindow(key, v, opts),
    [key],
  );
  return [value, setValue];
}

/** A float hash param. */
export function useHashParamFloat(
  key: string,
  defaultValue?: number,
): [number | undefined, HashParamSetter<number>] {
  const value = useHashValue<number | undefined>(() =>
    getHashParamValueFloatFromWindow(key) ?? defaultValue
  );
  const setValue = useCallback<HashParamSetter<number>>(
    (v, opts) => setHashParamValueFloatInWindow(key, v, opts),
    [key],
  );
  return [value, setValue];
}
