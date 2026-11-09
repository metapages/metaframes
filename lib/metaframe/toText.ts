import { type DataRef, dataRefToFile, isDataRef } from "@metapages/dataref";

/**
 * Whatever arrived on an input pipe, as text.
 *
 * A metapage may send a string, a plain object, a Blob, or a dataref — a
 * pointer to content held elsewhere, which has to be fetched. A frame that
 * only handled strings would show `[object Object]` to anyone who wired up
 * the obvious thing, so the conversion belongs here rather than in each
 * frame.
 *
 * Returns `undefined` for nothing to show, so a caller can leave its document
 * alone rather than blanking it.
 */
export async function toText(value: unknown): Promise<string | undefined> {
  if (value === undefined || value === null) return undefined;

  if (isDataRef(value)) {
    // Chrome caches a request ignoring the Vary header, so the same presigned
    // URL fetched from two origins — routine here, since metaframes are
    // iframes — fails on the second fetch.
    // https://issues.chromium.org/issues/41025985
    const fetchOptions = /Chrome/.test(navigator.userAgent ?? "")
      ? { cache: "no-store" as RequestCache }
      : undefined;
    const file = await dataRefToFile(value as DataRef, { fetchOptions });
    return await file.text();
  }

  if (typeof value === "string") return value;
  if (value instanceof Blob) return await value.text();

  // Anything else is structured data the viewer should be able to read and
  // edit, so it is pretty-printed rather than stringified compactly.
  return JSON.stringify(value, null, 2);
}
