import { assertEquals } from "jsr:@std/assert@^1";
import { createEchoGuard } from "./editorEcho.ts";

Deno.test("an echo of the only outstanding edit is not external", () => {
  const guard = createEchoGuard();
  guard.emitted("ab");
  assertEquals(guard.isExternal("ab", "ab"), false);
});

Deno.test("a stale echo is not external — the lock-up this exists to stop", () => {
  // Two keystrokes inside one render batch: both are emitted before either
  // comes back, so the first prop to arrive carries text the editor has
  // already moved past. Treating it as external writes it back into the
  // editor, which emits again, forever.
  const guard = createEchoGuard();
  guard.emitted("a");
  guard.emitted("ab");

  assertEquals(guard.isExternal("a", "ab"), false, "the stale echo is ours");
  assertEquals(
    guard.isExternal("ab", "ab"),
    false,
    "and so is the current one",
  );
});

Deno.test("an echo arriving out of order drops the ones skipped past", () => {
  const guard = createEchoGuard();
  guard.emitted("a");
  guard.emitted("ab");
  guard.emitted("abc");

  // The caller coalesced and only handed back the newest.
  assertEquals(guard.isExternal("abc", "abc"), false);
  // Nothing is left outstanding, so an older value now really is external.
  assertEquals(guard.isExternal("a", "abc"), true);
});

Deno.test("a value the editor never emitted is external", () => {
  const guard = createEchoGuard();
  guard.emitted("typed");
  assertEquals(guard.isExternal("from a pipe", "typed"), true);
});

Deno.test("a value equal to what the editor holds is never applied", () => {
  const guard = createEchoGuard();
  assertEquals(guard.isExternal("same", "same"), false);
});

Deno.test("an external value clears what was outstanding", () => {
  const guard = createEchoGuard();
  guard.emitted("a");
  guard.emitted("ab");
  assertEquals(guard.isExternal("replaced", "ab"), true);
  // "ab" was dropped with the rest, so it is now a genuine outside change.
  assertEquals(guard.isExternal("ab", "replaced"), true);
});

Deno.test("the queue does not grow without bound when nothing echoes", () => {
  const guard = createEchoGuard(3);
  for (const text of ["a", "ab", "abc", "abcd", "abcde"]) guard.emitted(text);
  // The oldest were dropped, so they read as external now.
  assertEquals(guard.isExternal("a", "abcde"), true);
  guard.emitted("abcdef");
  assertEquals(guard.isExternal("abcdef", "abcdef"), false);
});
