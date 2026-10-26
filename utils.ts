import { createDefine } from "fresh";
import type { FrameMeta } from "./lib/registry.ts";

export interface State {
  /** The frame this request is for, resolved from the path by main.ts. */
  frame: FrameMeta | null;
}

export const define = createDefine<State>();
