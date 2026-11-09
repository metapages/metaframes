/**
 * What a text-editing frame should put on its output pipe.
 *
 * In `json` mode a document that looks like JSON is parsed first, so a
 * downstream metaframe receives a real object rather than a string it has to
 * parse itself. This is published behaviour (llms-full.txt §4) and metapages
 * in the wild are wired to expect it.
 *
 * Invalid JSON is passed through as text rather than throwing, which is what
 * makes the editor usable *while* JSON is being typed: half an object is not
 * an error, it is a document in progress.
 */
export function outputPayload(text: string, language: string): unknown {
  if (language !== "json") return text;
  const trimmed = text?.trim() ?? "";
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return text;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
