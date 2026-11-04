import type { ComponentChildren, JSX } from "preact";
import { useCallback, useEffect, useMemo, useState } from "preact/hooks";

import type { FrameOption, ToolbarItem } from "../lib/registry.ts";
import { type HelpConfig, helpUrlFrom } from "../lib/help.ts";
import { useHashParam } from "../lib/hash/useHashParam.ts";
import {
  deleteSearchParamFromUrl,
  useSearchParamBoolean,
} from "../lib/search/useSearchParam.ts";
import { type HeaderAction, MainHeader } from "./MainHeader.tsx";
import { PanelHeader } from "./PanelHeader.tsx";
import { OptionsPanel } from "./OptionsPanel.tsx";
import { HelpPanel } from "./HelpPanel.tsx";
import { IconList } from "./icons.tsx";
import type { IconName } from "./icons.tsx";

/**
 * The search param that means "the menu is open".
 *
 * A search param rather than a hash param: the hash is the frame's state,
 * which @metapages/metapage watches and reports up to the parent metapage, so
 * putting the menu there made every toggle look like the document had changed.
 * Whether the menu is open is local to this tab.
 */
const SEARCH_KEY_EDIT = "edit";

/**
 * Params describing *authoring* rather than the document, left out of a copied
 * URL. A link you share should open the thing itself.
 */
const AUTHORING_PARAMS = [SEARCH_KEY_EDIT];

/**
 * A panel a frame supplies itself — an editor, an inspector — for what
 * configuration cannot describe. The first one a frame declares is what the
 * menu opens on.
 */
export interface FramePanel {
  key: string;
  label: string;
  icon: IconName;
  content: ComponentChildren;
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
   * Header buttons the frame supplies — a Run button, a reset. For actions
   * that need a handler, which `toolbar` (pure data in config.ts) cannot
   * express. They act and finish; they never render as selected.
   */
  actions?: FrameAction[];
}

/** A header button a frame wires up itself. */
export interface FrameAction {
  key: string;
  label: string;
  icon: IconName;
  onClick: () => void;
}

/**
 * The chrome every frame shares, following the framejs.io editor.
 *
 * The shape, and why:
 *
 * - **`?edit=true` is the menu.** Without it a frame is only its renderer — no
 *   header, no panels, nothing of the editor loaded. With it the whole
 *   authoring surface opens: header bar, and a panel beside the renderer. It
 *   is one param for one idea, the same way framejs.io's close button turns
 *   its editor off. It sits in the query rather than the hash because it is
 *   local UI, not part of the document the frame is showing.
 *
 * - The frame's renderer is the page. It sits in one fixed position in a
 *   single element tree and is never moved or unmounted by the chrome.
 *   Branching the tree on chrome state makes Preact recreate the renderer's
 *   DOM, which silently empties any frame that writes its own HTML.
 *
 * - The panel column holds exactly one panel at a time, like tabs. Two panels
 *   open at once reads as two independent toggles, which is what it is not.
 *
 * - State between a panel and the renderer travels through hash params (the
 *   editor writes `md`, the renderer reads it), so the two never need to know
 *   about each other.
 *
 * `hm` still decides how reachable the menu is, for embeds that want it gone:
 *
 *   undefined | "invisible"  the open-menu button is transparent until
 *                            hovered, but always clickable
 *   "visible"                the open-menu button is always drawn
 *   "disabled"               no menu and no button, ever
 *
 * The chrome renders only after mount, so the server never has to guess at
 * something only the URL fragment knows.
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
    actions: frameActions = [],
  }: FrameShellProps,
): JSX.Element {
  const [mode] = useHashParam("hm");
  // The menu's open state lives in the query: a frame with no `edit` is just
  // its renderer, which is what an embed and a shared link should be.
  const [edit, setEdit] = useSearchParamBoolean(SEARCH_KEY_EDIT);
  const [mounted, setMounted] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2000);
    return () => clearTimeout(t);
  }, [toast]);

  /**
   * Copy the document's URL, not the workbench's: `edit` says the menu happens
   * to be open here, which is nobody else's business.
   */
  const copyUrl = useCallback(() => {
    let url = new URL(globalThis.location.href);
    for (const param of AUTHORING_PARAMS) {
      url = deleteSearchParamFromUrl(url, param);
    }
    globalThis.navigator?.clipboard?.writeText(url.href)
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

  /** Opening the menu lands on the frame's own first panel — its editor. */
  const defaultPanelKey = panels[0]?.key ?? null;

  // `undefined` means "nothing chosen yet, use the default"; `null` means the
  // user deliberately closed the panel and wants only the renderer.
  const [chosen, setChosen] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    // Closing the menu forgets the choice, so reopening starts fresh.
    if (!edit) setChosen(undefined);
  }, [edit]);

  const activeKey = chosen === undefined ? defaultPanelKey : chosen;

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
    ...frameActions,
    ...allPanels.map((panel): HeaderAction => ({
      key: panel.key,
      label: panel.label,
      icon: panel.icon,
      selectable: true,
      onClick: () => setChosen(activeKey === panel.key ? null : panel.key),
    })),
    ...toolbarActions,
    {
      key: "copy-url",
      label: "copy URL to clipboard",
      icon: "copy",
      onClick: copyUrl,
    },
  ], [frameActions, allPanels, toolbarActions, activeKey, copyUrl]);

  const chromeAllowed = mounted && mode !== "disabled";
  const chromeVisible = chromeAllowed && edit;
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
          onWordmarkClick={() => setChosen(null)}
          onClose={() => setEdit(undefined)}
        />
      )}

      <div class="relative flex min-h-0 w-full flex-1 overflow-hidden">
        <div class="relative min-h-0 min-w-0 flex-1">{children}</div>

        {panel && (
          <aside
            // max-width, because a panel's width is configuration (the
            // markdown editor's `editorWidth` defaults to 80ch) and must not
            // be able to crowd the renderer out of a narrow frame.
            class="flex min-h-0 max-w-[70%] shrink-0 flex-col border-l border-line bg-surface-2"
            style={{ width: panel.width ?? "50%" }}
          >
            <PanelHeader title={panel.label} onClose={() => setChosen(null)} />
            <div class="min-h-0 flex-1 overflow-y-auto">{panel.content}</div>
          </aside>
        )}

        {chromeAllowed && !edit && (
          <button
            type="button"
            onClick={() => setEdit(true)}
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
