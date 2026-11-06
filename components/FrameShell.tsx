import type { ComponentChildren, JSX } from "preact";
import { useCallback, useEffect, useMemo, useState } from "preact/hooks";
import { deleteHashParamFromUrl } from "@metapages/hash-query";
import type { FrameOption, ToolbarItem } from "../lib/registry.ts";
import { type HelpConfig, helpUrlFrom } from "../lib/help.ts";
import { useHashParamBoolean } from "../lib/hash/useHashParam.ts";
import { useEditorMode } from "../lib/hash/useEditorMode.ts";
import { type HeaderAction, MainHeader } from "./MainHeader.tsx";
import { PanelColumn } from "./PanelColumn.tsx";
import { OptionsPanel } from "./OptionsPanel.tsx";
import { SHELL_OPTIONS } from "./shellOptions.ts";
import { HelpPanel } from "./HelpPanel.tsx";
import { IconList } from "./icons.tsx";
import type { IconName } from "./icons.tsx";

/** The hash param that means "the menu is open". */
const HASH_KEY_EDIT = "edit";

/**
 * Params that describe *authoring*, not the document, and so are left out of a
 * copied URL. A link you share should open the thing itself.
 */
const AUTHORING_PARAMS = [HASH_KEY_EDIT];

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
  /**
   * CSS width of the panel column, until the viewer drags the split. Defaults
   * to half the frame. One dragged width per frame is remembered per viewer in
   * localStorage and outranks this, for every panel — see PanelColumn.tsx.
   */
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
 * - **`edit` is the menu.** Without it a frame is only its renderer — no
 *   header, no panels, nothing of the editor loaded. With `edit=true` the
 *   whole authoring surface opens: header bar, and a panel beside the
 *   renderer. It is one hash param for one idea, the same way framejs.io's
 *   close button turns its editor off.
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
 * `editor` decides how reachable the menu is, so an external system can say
 * whether the content is editable here at all (the published name was `hm`,
 * still read — see lib/hash/useEditorMode.ts):
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
  const mode = useEditorMode();
  // The menu's open state lives in the URL: a frame with no `edit` is just its
  // renderer, which is what an embed and a shared link should be.
  const [edit, setEdit] = useHashParamBoolean(HASH_KEY_EDIT);
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
      url = deleteHashParamFromUrl(url, param);
    }
    globalThis.navigator?.clipboard?.writeText(url.href)
      .then(() => setToast("Copied URL to clipboard"))
      .catch(() => setToast("Could not copy URL"));
  }, []);

  /**
   * The frame's own settings, then the shell's. Every frame gets the shell's,
   * so every frame can hide its own edit button from its settings panel —
   * which is where the published editor put that control.
   */
  const settingsOptions = useMemo<FrameOption[]>(
    () => [...options ?? [], ...SHELL_OPTIONS],
    [options],
  );

  /** Frame panels first, then the two the shell always provides. */
  const allPanels = useMemo<FramePanel[]>(() => {
    const list = [...panels];
    if (settingsOptions.length) {
      list.push({
        key: "settings",
        label: "settings",
        icon: "gear",
        content: (
          <OptionsPanel options={settingsOptions} hashKey={optionsHashKey} />
        ),
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
  }, [panels, settingsOptions, optionsHashKey, help, mounted]);

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
          <PanelColumn
            // Keyed, so switching panels builds the new panel's content
            // rather than diffing it against the old one's. The remembered
            // width is the frame's, so it survives the remount.
            key={panel.key}
            frame={help.frame}
            panelKey={panel.key}
            label={panel.label}
            declaredWidth={panel.width}
            onClose={() => setChosen(null)}
          >
            {panel.content}
          </PanelColumn>
        )}

        {chromeAllowed && !edit && (
          <button
            type="button"
            onClick={() => setEdit(true)}
            aria-label="Show menu"
            title="Show menu"
            // Transparent but clickable by default: the chrome should not
            // intrude on an embedded frame, while staying reachable.
            // `editor=visible` opts into drawing it always.
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
