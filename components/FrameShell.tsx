import type { ComponentChildren, JSX } from "preact";
import { useCallback, useEffect, useMemo, useState } from "preact/hooks";
import { isIframe } from "@metapages/metapage";
import {
  addEventListenerHashParamBoolean,
  getHashParamValueBooleanFromWindow,
  setHashParamValueBooleanInWindow,
} from "@metapages/hash-query";
import type { FrameOption, ToolbarItem } from "../lib/registry.ts";
import { type HelpConfig, helpUrlFrom } from "../lib/help.ts";
import { useHashParam } from "../lib/hash/useHashParam.ts";
import { type HeaderAction, MainHeader } from "./MainHeader.tsx";
import { PanelHeader } from "./PanelHeader.tsx";
import { OptionsPanel } from "./OptionsPanel.tsx";
import { HelpPanel } from "./HelpPanel.tsx";
import { IconList } from "./icons.tsx";
import type { IconName } from "./icons.tsx";

/**
 * A panel a frame supplies itself — an editor, an inspector — for what
 * configuration cannot describe.
 */
export interface FramePanel {
  key: string;
  label: string;
  icon: IconName;
  content: ComponentChildren;
  /**
   * Persist "this panel is open" in a hash param, so a shared URL reopens it
   * (the markdown frame's `edit`). Panels without one are ephemeral UI.
   */
  param?: string;
  /** CSS width of the panel column. Defaults to half the frame. */
  width?: string;
}

export interface FrameShellProps {
  /** Mono wordmark in the header, the way framejs.io shows "js". */
  wordmark: string;
  /** Human title, used for the wordmark tooltip. */
  title: string;
  /**
   * How to reach this frame's help. Resolved to a URL in the browser, where
   * `location` is authoritative — see lib/help.ts for why the server is not.
   */
  help: HelpConfig;
  /**
   * The frame's output — the thing it exists to show. Always mounted, in one
   * fixed position, whatever the chrome is doing.
   */
  children: ComponentChildren;
  /** Declarative settings schema; omit for a frame with no settings. */
  options?: FrameOption[];
  optionsHashKey?: string;
  /** Header controls declared as data in the frame's config.ts. */
  toolbar?: ToolbarItem[];
  /** Panels the frame supplies, shown in the same slot as settings and help. */
  panels?: FramePanel[];
  /**
   * Whether the chrome starts hidden. Defaults to "hidden when embedded",
   * which is what every existing metaframe does.
   */
  menuHiddenDefault?: boolean;
}

/**
 * The chrome every frame shares, following the framejs.io editor.
 *
 * The shape, and why:
 *
 * - The frame's renderer is the page. It sits in one fixed position in a
 *   single element tree and is never moved or unmounted by the chrome.
 *   Branching the tree on chrome state (as this did before) makes Preact
 *   recreate the renderer's DOM, which silently empties any frame that writes
 *   its own HTML — the markdown frame went blank the moment the menu was
 *   hidden. A frame's renderer must be able to assume its node survives.
 *
 * - Everything else — the editor, settings, help — is *the menu*, and opens in
 *   one shared column beside the renderer. Hiding the menu hides all of it, so
 *   an embedded frame is just the renderer: small, light, nothing else loaded.
 *
 * - That column holds exactly one panel at a time, like tabs. Two panels open
 *   at once reads as two independent toggles, which is what it is not.
 *
 * - State between a panel and the renderer travels through hash params (the
 *   editor writes `md`, the renderer reads it), so the two never need to know
 *   about each other.
 *
 * `hm` semantics, reproduced from the metaframes this replaces because
 * published metapage URLs set it:
 *
 *   undefined | "invisible"  chrome hidden when embedded; the toggle is
 *                            transparent until hovered, but always clickable
 *   "visible"                as above, but the toggle is always drawn
 *   "disabled"               no chrome and no toggle, ever
 *
 * The chrome renders only after mount: `isIframe()` is false during SSR, so
 * deciding server-side would show chrome for one frame in every embed and
 * cause a hydration mismatch.
 */
export function FrameShell(
  {
    wordmark,
    title,
    help,
    children,
    options,
    optionsHashKey = "options",
    toolbar = [],
    panels = [],
    menuHiddenDefault,
  }: FrameShellProps,
): JSX.Element {
  const [mode] = useHashParam("hm");
  const [mounted, setMounted] = useState(false);
  const [menuHidden, setMenuHidden] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    setMenuHidden(menuHiddenDefault ?? isIframe());
    setMounted(true);
  }, [menuHiddenDefault]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2000);
    return () => clearTimeout(t);
  }, [toast]);

  const copyUrl = useCallback(() => {
    globalThis.navigator?.clipboard?.writeText(globalThis.location.href)
      .then(() => setToast("Copied URL to clipboard"))
      .catch(() => setToast("Could not copy URL"));
  }, []);

  /** Frame panels first, then the two the shell always provides. */
  const allPanels = useMemo<FramePanel[]>(() => {
    const list = [...panels];
    if (options?.length) {
      list.push({
        key: "settings",
        label: "settings",
        icon: "gear",
        content: <OptionsPanel options={options} hashKey={optionsHashKey} />,
      });
    }
    list.push({
      key: "help",
      label: "help",
      icon: "question",
      // `mounted` is in the deps so the URL is built once `location` exists.
      content: mounted ? <HelpPanel url={helpUrlFrom(help)} /> : null,
    });
    return list;
  }, [panels, options, optionsHashKey, help, mounted]);

  // Ephemeral selection, for panels with no hash param of their own.
  const [localPanel, setLocalPanel] = useState<string | null>(null);
  // Selection that lives in the hash, so a shared URL reopens the same panel.
  const [hashPanel, setHashPanel] = useState<string | null>(null);

  /**
   * Which panels own a hash param. A stable string, so the subscriptions below
   * are not torn down and rebuilt every time a panel's content changes (the
   * markdown editor's content changes on every keystroke).
   */
  const panelParams = allPanels
    .filter((p) => p.param)
    .map((p) => `${p.key}:${p.param}`)
    .join(",");

  useEffect(() => {
    if (!panelParams) return;
    const disposers = panelParams.split(",").map((entry) => {
      const [key, param] = entry.split(":");
      // The module's own per-key subscription: it decodes the value and tells
      // us when that one param changes.
      return addEventListenerHashParamBoolean(param, (open) => {
        setHashPanel((previous) =>
          open ? key : previous === key ? null : previous
        );
      });
    });
    return () => disposers.forEach((dispose) => dispose());
  }, [panelParams]);

  /** The one open panel: a hash-backed one wins, else the ephemeral choice. */
  const activeKey = hashPanel ?? localPanel;

  /** Selecting a panel closes whichever was open: one slot, tab semantics. */
  const selectPanel = useCallback((key: string | null) => {
    for (const panel of allPanels) {
      if (!panel.param) continue;
      const shouldBeOpen = panel.key === key;
      const isOpen = getHashParamValueBooleanFromWindow(panel.param) ?? false;
      if (shouldBeOpen !== isOpen) {
        // Unset rather than write `false`: an absent param keeps shared URLs
        // free of defaults.
        setHashParamValueBooleanInWindow(
          panel.param,
          shouldBeOpen ? true : undefined,
        );
      }
    }
    setLocalPanel(
      key && !allPanels.find((p) => p.key === key)?.param ? key : null,
    );
  }, [allPanels]);

  /** Links declared in a frame's config. Not selectable — they just act. */
  const toolbarActions = useMemo<HeaderAction[]>(
    () =>
      toolbar.map((item): HeaderAction => ({
        key: `toolbar:${item.href}`,
        label: item.label,
        icon: item.icon,
        onClick: () =>
          globalThis.open?.(item.href, "_blank", "noopener,noreferrer"),
      })),
    [toolbar],
  );

  const actions = useMemo<HeaderAction[]>(() => [
    ...allPanels.map((panel): HeaderAction => ({
      key: panel.key,
      label: panel.label,
      icon: panel.icon,
      selectable: true,
      onClick: () => selectPanel(activeKey === panel.key ? null : panel.key),
    })),
    ...toolbarActions,
    {
      key: "copy-url",
      label: "copy URL to clipboard",
      icon: "copy",
      onClick: copyUrl,
    },
  ], [allPanels, toolbarActions, activeKey, selectPanel, copyUrl]);

  const chromeAllowed = mounted && mode !== "disabled";
  const chromeVisible = chromeAllowed && !menuHidden;
  const panel = chromeVisible
    ? allPanels.find((p) => p.key === activeKey)
    : undefined;

  return (
    // ONE tree. `children` below never changes position, so the frame's
    // renderer is never remounted by anything the chrome does.
    <div class="flex h-dvh w-full flex-col bg-paper">
      {chromeVisible && (
        <MainHeader
          wordmark={wordmark}
          title={title}
          actions={actions}
          shownPanel={activeKey}
          onWordmarkClick={() => selectPanel(null)}
          onClose={() => setMenuHidden(true)}
        />
      )}

      <div class="relative flex min-h-0 w-full flex-1 overflow-hidden">
        <div class="relative min-h-0 min-w-0 flex-1">{children}</div>

        {panel && (
          <aside
            // max-width, because a panel's width is configuration (the
            // markdown editor's `editorWidth` defaults to 80ch) and must not
            // be able to crowd the renderer out of a narrow frame.
            class="flex min-h-0 shrink-0 flex-col border-l border-line bg-surface-2 max-w-[70%]"
            style={{ width: panel.width ?? "50%" }}
          >
            <PanelHeader
              title={panel.label}
              onClose={() => selectPanel(null)}
            />
            <div class="min-h-0 flex-1 overflow-y-auto">{panel.content}</div>
          </aside>
        )}

        {chromeAllowed && menuHidden && (
          <button
            type="button"
            onClick={() => setMenuHidden(false)}
            aria-label="Show menu"
            title="Show menu"
            // Transparent but clickable by default: the chrome should not
            // intrude on an embedded frame, while staying reachable.
            // `hm=visible` opts into drawing it always.
            class={`absolute right-1 top-1 z-10 flex items-center justify-center rounded-control bg-paper/80 p-1.5 text-ink-2 transition-opacity duration-150 hover:bg-surface-2 hover:text-ink focus-visible:opacity-100 ${
              mode === "visible" ? "" : "opacity-0 hover:opacity-100"
            }`}
          >
            <IconList size="20px" />
          </button>
        )}
      </div>

      {toast && (
        <div class="plate fixed bottom-4 left-1/2 z-50 -translate-x-1/2 px-3 py-2 text-sm text-ink shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
