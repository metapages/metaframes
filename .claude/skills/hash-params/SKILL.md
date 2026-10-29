---
name: hash-params
description: Rules for reading, writing and subscribing to URL hash params in metaframes. Use whenever touching hash state — a frame's content, options, `hm`, `edit`, help URLs, or anything under `#?`. Triggers on base64/atob/btoa of hash values, location.hash, hashchange listeners, building a metaframe URL, or adding a hash param to a frame.
---

# Hash params: always `@metapages/hash-query`

The URL hash **is** a metaframe's state. It is what gets shared, embedded and
restored, and every published metapage in the wild depends on its exact wire
format. There is one module that owns that format:
[`@metapages/hash-query`](https://www.npmjs.com/package/@metapages/hash-query).

**Never hand-roll any part of it.** No `atob`/`btoa`, no `location.hash`
slicing, no `URLSearchParams` over a fragment, no regex, no string-concatenated
`#?a=1&b=2`, no bare `hashchange` listeners. If you are writing code that knows
what the hash looks like, you are writing a bug: a previous attempt in
`../metaframe-molstar-fresh` hand-rolled `#{json}` and silently broke every
shared URL.

Import from `@metapages/hash-query` (the framework-agnostic core). Do **not**
import `@metapages/hash-query/react-hooks` — it pulls in React. This repo wraps
the core in Preact hooks at `lib/hash/useHashParam.ts`; use those in components.

## Use the hooks

```ts
import {
  useHashParam, // plain string      e.g. hm, bgColor
  useHashParamBase64, // long text         e.g. md, text, py
  useHashParamBoolean, // flags             e.g. edit, debug
  useHashParamFloat,
  useHashParamInt,
  useHashParamJson, // structured        e.g. options
} from "../lib/hash/useHashParam.ts";

const [md, setMd] = useHashParamBase64("md");
const [edit, setEdit] = useHashParamBoolean("edit");
```

Setters take `undefined` to **remove** a param. Prefer that over writing a falsy
value: an absent param keeps shared URLs free of defaults.

```ts
setEdit(on ? true : undefined);
```

## Outside a component

Use the core directly — getters, setters, and the per-key subscriptions. Note
the subscribe functions return a disposer.

```ts
import {
  getHashParamValueBooleanFromWindow,
  setHashParamValueBooleanInWindow,
  addEventListenerHashParamJson,
  stringToBase64String,
  stringFromBase64String,
  setHashParamsInUrl,
} from "@metapages/hash-query";

const dispose = addEventListenerHashParamJson<Options>("options", (v) => { … });
```

## Building a URL for another frame

Set params on a `URL`, never by concatenating strings:

```ts
import { setHashParamsInUrl } from "@metapages/hash-query";

const url = setHashParamsInUrl(new URL(viewerOrigin), {
  hm: "disabled",
  url: readmeUrl,
});
```

## Encoding text

`stringToBase64String` / `stringFromBase64String`, never bare `btoa`/`atob`.
Bare `btoa` throws on any non-Latin1 character and corrupts `%`. The wire format
is `btoa(encodeURIComponent(s))`, and the module is the only place that should
know that.

## Why not just listen to `hashchange`

The module dispatches a synthetic `HashChangeEvent` after it rewrites the hash
with `replaceState`, so a raw listener _appears_ to work. Use
`addEventListenerHashParam*` anyway: it is per-key, hands you the decoded typed
value, and keeps this repo insulated if the notification mechanism ever changes.

## Compatibility rules

- **Never change a param's name or encoding.** Published metapages embed these
  URLs. Legacy aliases stay: the markdown frame still reads `base64` as well as
  `md`, and content starting with `%` is `decodeURIComponent`'d for URLs from an
  older encoding.
- List every param a frame reads in its `hashParams` in `frame.ts`, so the
  definition at `/<frame>/metaframe.json` stays truthful.
- Reading a param someone else wrote by hand must stay tolerant — some existing
  metaframes build `#?url=…` unencoded. The getters already handle it; do not
  "fix" the value on the way in.

## Writing on every keystroke

Don't. An editor emits per keystroke; each hash write rewrites the URL and wakes
every subscriber. Keep local state as the immediate source for rendering and
debounce the hash write (framejs.io uses 800ms). Equally, do not push the hash
value back into an editor while the user is typing — see
`components/CodeMirror.tsx` for the guard that prevents it.
