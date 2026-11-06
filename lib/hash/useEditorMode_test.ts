import { assertEquals } from "jsr:@std/assert@^1";
import { editorModeFrom, editorModeFromValue } from "./useEditorMode.ts";

Deno.test("editorModeFromValue keeps the published `hm` vocabulary", () => {
  assertEquals(editorModeFromValue("visible"), "visible");
  assertEquals(editorModeFromValue("invisible"), "invisible");
  assertEquals(editorModeFromValue("disabled"), "disabled");
});

Deno.test("editorModeFromValue defaults to a hover-only way in", () => {
  // Absent, empty and unrecognised all mean "don't intrude, stay reachable".
  assertEquals(editorModeFromValue(undefined), "invisible");
  assertEquals(editorModeFromValue(""), "invisible");
  assertEquals(editorModeFromValue("maybe"), "invisible");
});

Deno.test("editorModeFromValue accepts what an external system would write", () => {
  // The param now reads as "is this editable", so booleans are the obvious
  // thing for a caller to send.
  assertEquals(editorModeFromValue("false"), "disabled");
  assertEquals(editorModeFromValue("none"), "disabled");
  assertEquals(editorModeFromValue("true"), "visible");
  assertEquals(editorModeFromValue(" DISABLED "), "disabled");
});

Deno.test("editorModeFrom honours published hm URLs", () => {
  // Every frame's help iframe is `#?hm=disabled&url=…`, and useHashParam
  // reports an absent `editor` as "" — the case `??` would have swallowed.
  assertEquals(editorModeFrom("", "disabled"), "disabled");
  assertEquals(editorModeFrom(undefined, "disabled"), "disabled");
  assertEquals(editorModeFrom("", "visible"), "visible");
});

Deno.test("editorModeFrom lets editor outrank hm", () => {
  assertEquals(editorModeFrom("visible", "disabled"), "visible");
  assertEquals(editorModeFrom("disabled", "visible"), "disabled");
  assertEquals(editorModeFrom("", ""), "invisible");
});
