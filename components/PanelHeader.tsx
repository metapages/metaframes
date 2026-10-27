import type { ComponentChildren, JSX } from "preact";
import { IconX } from "./icons.tsx";

/**
 * The bar at the top of an open panel, following the framejs.io editor: a mono
 * uppercase eyebrow title on the left, the panel's own controls centred, and a
 * close affordance on the right.
 */
export function PanelHeader(
  { title, onClose, children }: {
    title: string;
    onClose: () => void;
    children?: ComponentChildren;
  },
): JSX.Element {
  return (
    <div class="z-[2] flex min-h-8 w-full shrink-0 items-center justify-between overflow-hidden border-b border-line-strong bg-surface-2 pl-[18px] pr-4 py-2">
      <span class="eyebrow">{title.toUpperCase()}</span>
      <div class="flex h-full flex-1 items-center justify-center gap-4">
        {children}
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close panel"
        title="Close panel"
        class="flex items-center justify-center rounded-control p-1 text-ink-2 hover:bg-line-strong hover:text-ink"
      >
        <IconX size="14px" />
      </button>
    </div>
  );
}
