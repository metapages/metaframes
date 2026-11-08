import type { ComponentChildren, JSX } from "preact";

/**
 * The bar at the top of an open panel, following the framejs.io editor: a mono
 * uppercase eyebrow title on the left and the panel's own controls centred.
 *
 * There is no close affordance, because a panel is never closed: the column
 * always holds exactly one, and the menu's own close button is what puts the
 * frame back to just its renderer. See FrameShell.tsx.
 */
export function PanelHeader(
  { title, children }: {
    title: string;
    children?: ComponentChildren;
  },
): JSX.Element {
  return (
    <div class="z-[2] flex min-h-8 w-full shrink-0 items-center justify-between overflow-hidden border-b border-line-strong bg-surface-2 pl-[18px] pr-4 py-2">
      <span class="eyebrow">{title.toUpperCase()}</span>
      <div class="flex h-full flex-1 items-center justify-center gap-4">
        {children}
      </div>
    </div>
  );
}
