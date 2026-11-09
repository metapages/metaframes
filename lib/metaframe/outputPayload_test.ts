import { assertEquals } from "jsr:@std/assert@^1";
import { outputPayload } from "./outputPayload.ts";

Deno.test("json mode parses an object so downstream gets real data", () => {
  assertEquals(outputPayload('{"a":1}', "json"), { a: 1 });
});

Deno.test("json mode parses an array", () => {
  assertEquals(outputPayload("[1, 2]", "json"), [1, 2]);
});

Deno.test("leading whitespace does not hide the object", () => {
  assertEquals(outputPayload('\n  {"a":1}\n', "json"), { a: 1 });
});

Deno.test("half-typed json goes out as text, not an error", () => {
  // The state the document is in for most of the time someone is typing it.
  assertEquals(outputPayload('{"a":', "json"), '{"a":');
});

Deno.test("json mode leaves a bare scalar alone", () => {
  // A number is valid JSON, but the published rule only parses { and [.
  assertEquals(outputPayload("42", "json"), "42");
  assertEquals(outputPayload("hello", "json"), "hello");
});

Deno.test("any other language is never parsed", () => {
  assertEquals(outputPayload('{"a":1}', "python"), '{"a":1}');
  assertEquals(outputPayload('{"a":1}', "plaintext"), '{"a":1}');
});

Deno.test("empty text is safe", () => {
  assertEquals(outputPayload("", "json"), "");
});
