import { Metaframe } from "@metapages/metapage";

// One Metaframe instance per page. It speaks the parent metapage's postMessage
// protocol, so it must only ever be constructed in the browser.
let instance: Metaframe | undefined;

export function getMetaframe(): Metaframe {
  if (typeof document === "undefined") {
    throw new Error("Metaframe can only be created in the browser");
  }
  if (!instance) instance = new Metaframe();
  return instance;
}

/** The instance if one exists, without creating it. Safe during SSR. */
export function peekMetaframe(): Metaframe | undefined {
  return instance;
}

export type { Metaframe };
