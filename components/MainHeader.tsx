import type { JSX } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import { IconList, ICONS } from "./icons.tsx";
import type { IconName } from "./icons.tsx";

/**
 * Width (px) below which the icon row no longer fits and the header collapses
 * to just [menu] … [close]. Measured on the header itself rather than the
 * viewport: a metaframe is embedded in an iframe sized independently of the
 * page it sits on, so a media query would ask the wrong question.
 */
const MIN_WIDTH_FOR_ICON_ROW = 420;

export interface HeaderAction {
  /**
   * Matches the shell's `shownPanel` for actions that open a panel, so the
   * icon can render as selected.
   */
  key: string;
  label: string;
  icon: IconName;
  onClick: () => void;
  /** Rendered as pressed (a toggle that is currently on). */
  active?: boolean;
}

const capitalize = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

/**
 * The frame's top bar, following the framejs.io editor: a mono wordmark on the
 * left, a row of icon actions on the right, and the close button last.
 *
 * Actions come from configuration (a frame's `toolbar`, plus the panels the
 * shell provides), so a frame never writes a header.
 */
export function MainHeader(
  { wordmark, title, actions, shownPanel, onWordmarkClick, onClose }: {
    wordmark: string;
    /** Full frame name, shown as the wordmark's tooltip. */
    title: string;
    actions: HeaderAction[];
    shownPanel: string | null;
    onWordmarkClick: () => void;
    onClose: () => void;
  },
): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isNarrow, setIsNarrow] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const element = containerRef.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      setIsNarrow(entries[0].contentRect.width < MIN_WIDTH_FOR_ICON_ROW);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // Close the overflow menu on any outside click or Escape.
  useEffect(() => {
    if (!menuOpen) return;
    const close = () => setMenuOpen(false);
    const onKey = (e: KeyboardEvent) =>
      e.key === "Escape" && setMenuOpen(false);
    globalThis.addEventListener("click", close);
    globalThis.addEventListener("keydown", onKey);
    return () => {
      globalThis.removeEventListener("click", close);
      globalThis.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const iconButton = (action: HeaderAction) => {
    const Icon = ICONS[action.icon];
    const selected = action.active || action.key === shownPanel;
    return (
      <button
        key={action.key}
        type="button"
        onClick={action.onClick}
        title={capitalize(action.label)}
        aria-label={capitalize(action.label)}
        aria-pressed={selected}
        class={`flex h-10 w-7 shrink-0 items-center justify-center text-ink-2 hover:text-ink ${
          selected ? "text-ink" : ""
        }`}
      >
        <span
          class={`flex items-center justify-center rounded-[5px] p-[3px] transition-colors duration-150 ${
            selected ? "bg-line-strong" : "hover:bg-line-strong/60"
          }`}
        >
          <Icon size="22px" />
        </span>
      </button>
    );
  };

  const menuItem = (action: HeaderAction) => {
    const Icon = ICONS[action.icon];
    return (
      <button
        key={action.key}
        type="button"
        onClick={action.onClick}
        class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-ink hover:bg-surface-2"
      >
        <Icon size="18px" />
        <span>{capitalize(action.label)}</span>
      </button>
    );
  };

  return (
    <div
      ref={containerRef}
      // flex-end, not space-between: when the icons stop fitting the overflow
      // is clipped off the LEFT edge, so the right-hand side — ending in the
      // close button — always stays reachable.
      class="flex h-10 w-full max-w-full shrink-0 items-center justify-end overflow-hidden border-b border-line bg-paper"
    >
      {
        /* Grows to push the icons right when there is room; first to be squeezed
          when there is not. In the narrow layout it holds the overflow menu. */
      }
      <div
        class={`flex h-10 min-w-0 flex-auto items-center overflow-visible ${
          isNarrow ? "px-2" : ""
        }`}
      >
        {isNarrow
          ? (
            <div class="relative">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen((o) => !o);
                }}
                aria-label="Menu"
                aria-expanded={menuOpen}
                class="flex h-10 items-center justify-center text-ink-2 hover:text-ink"
              >
                <span class="flex items-center justify-center rounded-[5px] p-[3px] hover:bg-line-strong/60">
                  <IconList size="22px" />
                </span>
              </button>
              {menuOpen && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  class="plate absolute left-0 top-10 z-30 min-w-44 py-1 shadow-lg"
                >
                  {actions.map(menuItem)}
                </div>
              )}
            </div>
          )
          : (
            <button
              type="button"
              onClick={onWordmarkClick}
              title={title}
              class="mx-3 flex h-10 shrink-0 items-center font-mono text-sm font-medium tracking-[0.04em] text-ink-2 hover:bg-surface-2 hover:text-ink"
            >
              {wordmark}
            </button>
          )}
      </div>

      <div
        class={`flex h-10 w-auto shrink-0 items-center justify-around bg-paper px-2 ${
          isNarrow ? "" : "border-l border-line"
        }`}
      >
        {isNarrow ? null : actions.map(iconButton)}
        {iconButton({
          key: "close",
          label: "close",
          icon: "x",
          onClick: onClose,
        })}
      </div>
    </div>
  );
}
