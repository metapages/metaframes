import type { ComponentChildren } from "preact";
import { useCallback, useEffect, useState } from "preact/hooks";
import { isIframe } from "@metapages/metapage";
import type { FrameOption } from "../lib/registry.ts";
import { useHashParam } from "../lib/hash/useHashParam.ts";
import { OptionsPanel } from "./OptionsPanel.tsx";
import { HelpPanel } from "./HelpPanel.tsx";
import {
  IconCopy,
  IconHelp,
  IconMenu,
  IconSettings,
  IconView,
} from "./icons.tsx";

export interface FrameTab {
  label: string;
  icon?: ComponentChildren;
  content: ComponentChildren;
}

export interface FrameShellProps {
  title: string;
  /**
   * Absolute URL of this frame's help document rendered by the markdown frame.
   * Computed server-side so it is right in both URL forms.
   */
  helpUrl: string;
  /** The main panel. Shown bare whenever the chrome is hidden. */
  children: ComponentChildren;
  /** Label for the main tab. */
  mainLabel?: string;
  /** Extra tabs, inserted between Main and Options. */
  tabs?: FrameTab[];
  /** Declarative Options tab. Omit for a frame with no settings. */
  options?: FrameOption[];
  optionsHashKey?: string;
  /**
   * Whether the chrome starts hidden. Defaults to "hidden when embedded",
   * which is what every existing metaframe does.
   */
  menuHiddenDefault?: boolean;
}

/**
 * The chrome shared by every frame: Main / Options / Help tabs, a copy-URL
 * button, and the `hm` hash param that lets an embedding metapage control how
 * much of it shows.
 *
 * `hm` semantics are reproduced exactly from the existing metaframes, because
 * published metapage URLs set it:
 *
 *   undefined | "visible"  chrome hidden when embedded, toggle button shown
 *   "invisible"            toggle rendered but transparent (still clickable)
 *   "disabled"             no chrome and no toggle, ever
 *
 * The chrome renders only after mount. `isIframe()` is false during SSR, so
 * deciding server-side would show chrome for one frame in every embed and
 * cause a hydration mismatch. The metaframes this replaces were entirely
 * client-rendered, so this is not a regression.
 */
export function FrameShell(
  {
    title,
    helpUrl,
    children,
    mainLabel = "Main",
    tabs = [],
    options,
    optionsHashKey = "options",
    menuHiddenDefault,
  }: FrameShellProps,
) {
  const [mode] = useHashParam("hm");
  const [mounted, setMounted] = useState(false);
  const [menuHidden, setMenuHidden] = useState(false);
  const [tab, setTab] = useState(0);
  // Tabs mount on first activation and stay mounted afterwards (Chakra's
  // isLazy + keepMounted). Mounting eagerly would load every frame's Help
  // iframe — and whatever its README pulls in — on every page load; keeping
  // them mounted means switching to Options and back does not tear down a
  // main panel holding real state (an editor, a 3D viewer, a Python runtime).
  const [visited, setVisited] = useState<Set<number>>(() => new Set([0]));
  const [toast, setToast] = useState<string | null>(null);

  const selectTab = useCallback((index: number) => {
    setTab(index);
    setVisited((previous) =>
      previous.has(index) ? previous : new Set(previous).add(index)
    );
  }, []);

  useEffect(() => {
    setMenuHidden(menuHiddenDefault ?? isIframe());
    setMounted(true);
  }, [menuHiddenDefault]);

  const copyUrl = useCallback(() => {
    globalThis.navigator?.clipboard?.writeText(globalThis.location.href)
      .then(() => setToast("Copied URL to clipboard"))
      .catch(() => setToast("Could not copy URL"));
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2000);
    return () => clearTimeout(t);
  }, [toast]);

  const main = <div class="flex-1 min-h-0 min-w-0">{children}</div>;

  // Before mount, and when the embedding metapage asked for no chrome at all.
  if (!mounted || mode === "disabled") {
    return <div class="w-full h-dvh flex flex-col">{main}</div>;
  }

  if (menuHidden) {
    return (
      <div class="w-full h-dvh flex flex-col relative">
        <button
          type="button"
          onClick={() => setMenuHidden(false)}
          // "invisible" keeps the button clickable but transparent: that is
          // deliberate in the existing metaframes.
          class={`absolute top-1 right-1 z-10 p-1.5 rounded-md bg-white/80 hover:bg-gray-100 ${
            mode === "invisible" ? "opacity-0 hover:opacity-100" : ""
          }`}
          aria-label="Show menu"
          title="Show menu"
        >
          <IconMenu />
        </button>
        {main}
      </div>
    );
  }

  const allTabs: FrameTab[] = [
    { label: mainLabel, icon: <IconView />, content: children },
    ...tabs,
  ];
  if (options?.length) {
    allTabs.push({
      label: "Options",
      icon: <IconSettings />,
      content: <OptionsPanel options={options} hashKey={optionsHashKey} />,
    });
  }
  allTabs.push({
    label: "Help",
    icon: <IconHelp />,
    content: <HelpPanel url={helpUrl} />,
  });

  const active = allTabs[Math.min(tab, allTabs.length - 1)];

  return (
    <div class="w-full h-dvh flex flex-col">
      <div class="flex items-center gap-1 px-1 border-b border-gray-200 bg-white shrink-0">
        {allTabs.map((t, i) => (
          <button
            key={t.label}
            type="button"
            onClick={() => selectTab(i)}
            class={`flex items-center gap-1 px-2 py-1.5 text-sm border-b-2 -mb-px transition-colors ${
              i === tab
                ? "border-blue-500 text-blue-700"
                : "border-transparent text-gray-600 hover:text-gray-900"
            }`}
          >
            {t.icon}
            <span>{t.label}</span>
          </button>
        ))}
        <button
          type="button"
          onClick={copyUrl}
          class="p-1.5 rounded-md text-gray-600 hover:bg-gray-100"
          aria-label="Copy URL to clipboard"
          title="Copy URL to clipboard"
        >
          <IconCopy />
        </button>
        <div class="flex-1" />
        <span class="px-2 text-xs text-gray-400 truncate">{title}</span>
        <button
          type="button"
          onClick={() => setMenuHidden(true)}
          class="p-1.5 rounded-md text-gray-600 hover:bg-gray-100"
          aria-label="Hide menu"
          title="Hide menu"
        >
          <IconMenu />
        </button>
      </div>
      {allTabs.map((t, i) =>
        visited.has(i)
          ? (
            <div
              key={t.label}
              class="flex-1 min-h-0 min-w-0"
              hidden={t !== active}
            >
              {t.content}
            </div>
          )
          : null
      )}
      {toast && (
        <div class="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 px-3 py-2 rounded-md bg-gray-900 text-white text-sm shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
