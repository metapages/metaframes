import type { FrameOption } from "../../lib/registry.ts";

// Imported by both frame.ts (for the registry / hashParams docs) and the
// island (to render the Options tab). It cannot be passed from the route into
// the island as a prop: options may carry `validator`/`map` functions, which
// do not survive island prop serialization.
export const options: FrameOption[] = [
  {
    name: "debug",
    displayName: "Show inputs as JSON",
    type: "boolean",
    default: false,
  },
];
