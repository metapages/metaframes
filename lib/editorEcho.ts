/** How many un-echoed emissions to remember. See `createEchoGuard`. */
const DEFAULT_LIMIT = 50;

export interface EchoGuard {
  /** Record text this editor has just emitted to its caller. */
  emitted(text: string): void;
  /**
   * Whether an incoming value is a genuine outside change that should be
   * written into the editor, rather than this editor's own text coming back.
   *
   * `current` is what the editor holds right now.
   */
  isExternal(value: string, current: string): boolean;
}

/**
 * Tells an editor's own echo apart from a real outside change.
 *
 * A controlled editor hands every edit to its caller, which stores it and
 * hands it back as a prop. That echo must not be written into the editor: by
 * the time it arrives the user has typed more, and writing it back would drop
 * those keystrokes.
 *
 * The obvious guard — remember the last text emitted and ignore a prop equal
 * to it — is wrong, and wrong in a way that locks up the browser tab rather
 * than merely losing a character. Keystrokes arrive faster than renders, so
 * two edits are often emitted before either comes back; the first prop then
 * carries text this editor emitted but has already moved past. Against a
 * single remembered string that reads as an outside change, so it is written
 * into the editor, which emits again, which arrives as another stale prop.
 * The two swap values forever and the page stops responding — reproduced in
 * both the Monaco and CodeMirror editors here by typing two characters
 * quickly.
 *
 * Remembering a queue fixes it: a prop matching anything still outstanding is
 * ours, and everything emitted before it has evidently been skipped.
 */
export function createEchoGuard(limit: number = DEFAULT_LIMIT): EchoGuard {
  const pending: string[] = [];

  return {
    emitted(text: string) {
      pending.push(text);
      // A caller that never echoes what it is given would otherwise grow this
      // without bound. Only recent entries can be mistaken for an outside
      // change, so dropping the oldest costs nothing.
      if (pending.length > limit) pending.shift();
    },

    isExternal(value: string, current: string) {
      const ours = pending.indexOf(value);
      if (ours !== -1) {
        pending.splice(0, ours + 1);
        return false;
      }
      // Already what the editor holds: nothing to apply, and nothing
      // outstanding can still be in flight.
      if (value === current) {
        pending.length = 0;
        return false;
      }
      pending.length = 0;
      return true;
    },
  };
}
