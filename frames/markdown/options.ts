import type { FrameOption } from "../../lib/registry.ts";

export const options: FrameOption[] = [
  {
    name: "dm",
    displayName: "Display mode",
    type: "option",
    options: ["default", "slide"],
    default: "default",
  },
  {
    name: "theme",
    displayName: "Mermaid theme",
    type: "option",
    options: ["default", "neutral", "dark", "forest", "base"],
    default: "default",
  },
  {
    name: "h",
    displayName: "Heading CSS classes",
    type: "string",
  },
];
