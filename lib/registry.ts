// The registry: one entry per directory under ./frames/.
//
// Assembled with an eager glob so adding a metaframe means adding a directory
// and nothing else — no string union to extend, no switch arm to add, no
// central import list to edit. (The previous attempt in ../metaframes-all kept
// a `MetaframeId` union that had to be edited in four places per metaframe.)

/** A declarative settings-form field, rendered by islands/OptionsMenu.tsx. */
export interface FrameOption {
  name: string;
  displayName: string;
  type?: "string" | "boolean" | "option" | "number";
  default?: string | boolean | number;
  /** Choices, for type: "option". */
  options?: string[];
  /** Extra fields revealed when a given choice is selected. */
  suboptions?: Record<string, FrameOption[]>;
  /** Return an error message, or undefined when valid. */
  validator?: (value: string | boolean | number) => string | undefined;
  /** Transform the value before it is persisted. */
  map?: (value: string | boolean | number) => string | boolean | number;
}

/**
 * The public /metaframe.json definition. Deliberately loose: metapage accepts
 * several schema versions and we only need enough structure to serve a valid
 * document.
 */
export interface MetaframeDefinition {
  version: string;
  metadata: {
    name?: string;
    title?: string;
    description?: string;
    author?: string;
    tags?: string[];
  };
  inputs?: Record<string, { type?: string; description?: string }>;
  outputs?: Record<string, { type?: string; description?: string }>;
  hashParams?: string[];
  /** Iframe permissions the embedding metapage should grant. */
  allow?: string;
}

/** What a frame's `frame.ts` exports (minus `name`, taken from the directory). */
export interface FrameConfig {
  title: string;
  description: string;
  /**
   * Subdomain labels mapping to this frame. The first is canonical, the rest
   * are backwards-compatible aliases for already-published URLs
   * (e.g. markdownv2.mtfm.io still has to resolve to the markdown frame).
   */
  hosts: string[];
  definition: MetaframeDefinition;
  /** Declarative Options tab schema. */
  options?: FrameOption[];
  /**
   * Extra response headers for this frame's routes only. Some metaframes need
   * them and applying them app-wide would break the others: bluetooth needs
   * Permissions-Policy, ffmpeg needs Cross-Origin-Embedder-Policy for
   * SharedArrayBuffer (which would block cross-origin embedding elsewhere).
   */
  headers?: Record<string, string>;
}

export interface FrameMeta extends FrameConfig {
  /** Directory name under ./frames/, and the path segment it is served on. */
  name: string;
  /** The frame's README.md, served as its in-app help. */
  readme?: string;
}

import readmes from "virtual:frame-readmes";

const modules = import.meta.glob<{ frame: FrameConfig }>(
  "../frames/*/frame.ts",
  { eager: true },
);

/** "../frames/markdown/frame.ts" -> "markdown" */
const frameNameOf = (path: string): string | undefined =>
  path.split("/").at(-2);

export const FRAMES: Record<string, FrameMeta> = {};
for (const [path, mod] of Object.entries(modules)) {
  const name = frameNameOf(path);
  if (!name || !mod?.frame) continue;
  FRAMES[name] = { ...mod.frame, name };
}
// Help text comes from a virtual module (see lib/vite/frameReadmes.ts) rather
// than a `?raw` import, whose query does not survive the SSR build.
for (const [name, readme] of Object.entries(readmes)) {
  if (FRAMES[name]) FRAMES[name].readme = readme;
}

/** Sorted for stable rendering on the landing page. */
export const FRAME_LIST: FrameMeta[] = Object.values(FRAMES).sort((a, b) =>
  a.name.localeCompare(b.name)
);

/** Subdomain label (including legacy aliases) -> frame name. */
export const FRAME_BY_HOST_LABEL: Record<string, string> = {};
for (const frame of FRAME_LIST) {
  for (const label of frame.hosts) FRAME_BY_HOST_LABEL[label] = frame.name;
}
