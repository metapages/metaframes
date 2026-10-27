import type { ComponentChildren, JSX } from "preact";
import { useCallback, useEffect, useMemo, useState } from "preact/hooks";
import { isIframe } from "@metapages/metapage";
import {
  getHashParamValueBooleanFromWindow,
  setHashParamValueBooleanInWindow,
} from "@metapages/hash-query";
import type { FrameOption, ToolbarItem } from "../lib/registry.ts";
import { type HelpConfig, helpUrlFrom } from "../lib/help.ts";
import { useHashChange, useHashParam } from "../lib/hash/useHashParam.ts";
import { type HeaderAction, MainHeader } from "./MainHeader.tsx";
import { PanelHeader } from "./PanelHeader.tsx";
import { OptionsPanel } from "./OptionsPanel.tsx";
import { HelpPanel } from "./HelpPanel.tsx";
import { IconList } from "./icons.tsx";
import type { IconName } from "./icons.tsx";

/** A panel a frame supplies itself, when configuration cannot express it. */
export interface FramePanel {
  key: string;
  label: string;
  icon: IconName;
  content: ComponentChildren;
}

export interface FrameShellProps {
  /** Mono wordmark in the header, the way framejs.io shows "js". */
  wordmark: string;
  /** Human title, used for the window/panel labels. */
  title: string;
  /**
   * How to reach this frame's help. Resolved to a URL in the browser, where
   * `location` is authoritative — see lib/help.ts for why the server is not.
   */
  help: HelpConfig;
  /** The main view. Always mounted, even while a panel covers it. */
  children: ComponentChildren;
  /** Declarative settings schema; omit for a frame with no settings. */
  options?: FrameOption[];
  optionsHashKey?: string;
  /** Header controls declared as data in the frame's frame.ts. */
  toolbar?: ToolbarItem[];
  /** Bespoke panels, for what configuration cannot describe. */
  panels?: FramePanel[];
  /**
   * Whether the chrome starts hidden. Defaults to "hidden when embedded",
   * which is what every existing metaframe does.
   */
  menuHiddenDefault?: boolean;
}

/**
 * The chrome every frame shares, following the framejs.io editor: a 40px
 * header of icon actions over a full-bleed main view, with settings and help
 * opening as panels rather than tabs.
 *
 * Frames do not write any of this. They declare a `toolbar` and `options` as
 * data and render their main view; the shell supplies the header, the panels,
 * the copy-URL action and the `hm` chrome modes.
 *
 * `hm` semantics are reproduced exactly from the metaframes this replaces,
 * because published metapage URLs set it:
 *
 *   undefined | "visible"  chrome hidden when embedded, toggle button shown
 *   "invisible"            toggle rendered but transparent (still clickable)
 *   "disabled"             no chrome and no toggle, ever
 *
 * The chrome renders only after mount: `isIframe()` is false during SSR, so
 * deciding server-side would show chrome for one frame in every embed and
 * cause a hydration mismatch. The metaframes this replaces were entirely
 * client-rendered, so this is not a regression.
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
  const [shownPanel, setShownPanel] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  // Toolbar items are configuration, so their params are not known at compile
  // time; one subscription keeps every read below fresh.
  const hashVersion = useHashChange();

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

  /** Frame-declared toolbar items, interpreted here so frames stay code-free. */
  const toolbarActions = useMemo<HeaderAction[]>(() => {
    // hashVersion is the dependency that makes the reads below re-run.
    void hashVersion;
    return toolbar.map((item): HeaderAction => {
      if (item.kind === "hashParamToggle") {
        const on = getHashParamValueBooleanFromWindow(item.param) ?? false;
        return {
          key: `toolbar:${item.param}`,
          label: item.label,
          icon: item.icon,
          active: on,
          // Unset rather than write `false`: an absent param keeps shared URLs
          // free of defaults.
          onClick: () =>
            setHashParamValueBooleanInWindow(
              item.param,
              on ? undefined : true,
            ),
        };
      }
      return {
        key: `toolbar:${item.href}`,
        label: item.label,
        icon: item.icon,
        onClick: () =>
          globalThis.open?.(item.href, "_blank", "noopener,noreferrer"),
      };
    });
  }, [toolbar, hashVersion]);

  const actions = useMemo<HeaderAction[]>(() => [
    ...toolbarActions,
    ...allPanels.map((panel): HeaderAction => ({
      key: panel.key,
      label: panel.label,
      icon: panel.icon,
      onClick: () =>
        setShownPanel((current) => current === panel.key ? null : panel.key),
    })),
    {
      key: "copy-url",
      label: "copy URL to clipboard",
      icon: "copy",
      onClick: copyUrl,
    },
  ], [toolbarActions, allPanels, copyUrl]);

  // The main view is mounted in the same place in every branch below, so that
  // opening a panel or hiding the chrome never tears it down: a frame's main
  // view can hold an editor buffer, a 3D viewer or a Python runtime.
  const main = <div class="relative min-h-0 min-w-0 flex-1">{children}</div>;

  const toastNode = toast
    ? (
      <div class="plate fixed bottom-4 left-1/2 z-50 -translate-x-1/2 px-3 py-2 text-sm text-ink shadow-lg">
        {toast}
      </div>
    )
    : null;

  // Before mount, and when the embedding metapage asked for no chrome at all.
  if (!mounted || mode === "disabled") {
    return <div class="flex h-dvh w-full flex-col bg-paper">{main}</div>;
  }

  if (menuHidden) {
    return (
      <div class="relative flex h-dvh w-full flex-col bg-paper">
        <button
          type="button"
          onClick={() => setMenuHidden(false)}
          aria-label="Show menu"
          title="Show menu"
          // "invisible" keeps the button clickable but transparent until
          // hovered: that is deliberate in the existing metaframes.
          class={`absolute right-1 top-1 z-10 flex items-center justify-center rounded-control bg-paper/80 p-1.5 text-ink-2 transition-opacity duration-150 hover:bg-surface-2 hover:text-ink ${
            mode === "invisible" ? "opacity-0 hover:opacity-100" : ""
          }`}
        >
          <IconList size="20px" />
        </button>
        {main}
        {toastNode}
      </div>
    );
  }

  const panel = allPanels.find((p) => p.key === shownPanel);

  return (
    <div class="flex h-dvh w-full flex-col bg-paper">
      <MainHeader
        wordmark={wordmark}
        title={title}
        actions={actions}
        shownPanel={shownPanel}
        onWordmarkClick={() => setShownPanel(null)}
        onClose={() => setMenuHidden(true)}
      />
      <div class="relative flex min-h-0 w-full flex-1 flex-col overflow-hidden">
        {main}
        {panel && (
          // Overlays the main view rather than replacing it, so the main view
          // keeps its state while a panel is open.
          <div class="absolute inset-0 z-[2] flex flex-col border-l border-line bg-surface-2">
            <PanelHeader
              title={panel.label}
              onClose={() => setShownPanel(null)}
            />
            <div class="min-h-0 flex-1 overflow-y-auto">{panel.content}</div>
          </div>
        )}
      </div>
      {toastNode}
    </div>
  );
}
