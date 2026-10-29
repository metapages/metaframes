// Preact hooks over @metapages/hash-query.
//
// The module owns the hash wire format — encoding, key order, notification —
// and nothing in this repo may reimplement any of it. See the `hash-params`
// skill. These hooks only adapt its API to Preact: reads come from its
// getters, writes from its setters, and updates from its per-key
// `addEventListenerHashParam*` subscriptions.
//
// We deliberately do NOT use @metapages/hash-query/react-hooks, which imports
// "react". The wire format is identical either way, so URLs already published
// by the existing metaframes keep working.

import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import {
  addEventListenerHashParamBase64,
  addEventListenerHashParamBoolean,
  addEventListenerHashParamFloat,
  addEventListenerHashParamInt,
  addEventListenerHashParamJson,
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

type Subscribe<T> = (
  key: string,
  listener: (value: T | undefined) => void,
) => () => void;

/**
 * True when a new value is indistinguishable from the one already held.
 *
 * This matters more than it looks: the JSON getter builds a fresh object on
 * every read, so without this every subscriber of every param re-renders on
 * every hash write, and anything keyed on that object's identity (a frame's
 * render effect) redoes its work.
 */
function unchanged<T>(a: T, b: T): boolean {
  if (Object.is(a, b)) return true;
  if (
    typeof a !== "object" || typeof b !== "object" || a === null || b === null
  ) {
    return false;
  }
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * One hash param as Preact state: seeded synchronously so there is no flash,
 * then kept current by the module's own per-key subscription.
 */
function useHashParamValue<T>(
  key: string,
  read: () => T | undefined,
  subscribe: Subscribe<T>,
  defaultValue: T,
): T {
  const [value, setValue] = useState<T>(() => {
    const v = IS_BROWSER ? read() : undefined;
    return v === undefined ? defaultValue : v;
  });

  // Held in refs so neither re-subscribes: callers routinely pass an inline
  // default (`useHashParamJson("options", {})`), which is a new object every
  // render.
  const current = useRef(value);
  current.current = value;
  const fallback = useRef(defaultValue);
  fallback.current = defaultValue;

  useEffect(() => {
    if (!IS_BROWSER) return;
    return subscribe(key, (incoming) => {
      const next = incoming === undefined ? fallback.current : incoming;
      if (unchanged(current.current, next)) return;
      current.current = next;
      setValue(next);
    });
  }, [key]);

  return value;
}

/** A plain string hash param, e.g. `hm`. */
export function useHashParam(
  key: string,
  defaultValue = "",
): [string, HashParamSetter<string>] {
  // The module exposes no per-key subscription for plain strings, so this
  // mirrors what its own useHashParam does: listen for `hashchange` and read
  // back through the module's getter. The getter is the part that matters —
  // the hash is never parsed here.
  const value = useHashParamValue<string>(
    key,
    () => getHashParamFromWindow(key),
    (k, listener) => {
      const onChange = () => listener(getHashParamFromWindow(k));
      globalThis.addEventListener("hashchange", onChange);
      return () => globalThis.removeEventListener("hashchange", onChange);
    },
    defaultValue,
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
  const value = useHashParamValue<string>(
    key,
    () => getHashParamValueBase64DecodedFromWindow(key),
    addEventListenerHashParamBase64,
    defaultValue,
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
  const value = useHashParamValue<T>(
    key,
    () => getHashParamValueJsonFromWindow<T>(key),
    addEventListenerHashParamJson as Subscribe<T>,
    defaultValue,
  );
  const setValue = useCallback<HashParamSetter<T>>(
    (v, opts) => setHashParamValueJsonInWindow(key, v, opts),
    [key],
  );
  return [value, setValue];
}

/** A boolean hash param, e.g. `edit` / `debug`. */
export function useHashParamBoolean(
  key: string,
  defaultValue = false,
): [boolean, HashParamSetter<boolean>] {
  const value = useHashParamValue<boolean>(
    key,
    () => getHashParamValueBooleanFromWindow(key),
    addEventListenerHashParamBoolean,
    defaultValue,
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
  const value = useHashParamValue<number | undefined>(
    key,
    () => getHashParamValueIntFromWindow(key),
    addEventListenerHashParamInt as Subscribe<number | undefined>,
    defaultValue,
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
  const value = useHashParamValue<number | undefined>(
    key,
    () => getHashParamValueFloatFromWindow(key),
    addEventListenerHashParamFloat as Subscribe<number | undefined>,
    defaultValue,
  );
  const setValue = useCallback<HashParamSetter<number>>(
    (v, opts) => setHashParamValueFloatInWindow(key, v, opts),
    [key],
  );
  return [value, setValue];
}
