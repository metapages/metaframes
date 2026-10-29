# metaframes

Every open-source [metaframe](https://metapage.io) served from **one
[Fresh](https://usefresh.dev) app on Cloudflare Workers**, with each metaframe a
directory under [`./frames/`](./frames).

This replaces one-repo-and-one-deployment per metaframe: ~13 projects on Deno
Deploy (which is shutting down) and ~26 GitHub Pages sites, each carrying its own
copy of the same build config and the same ~300 lines of UI chrome.

```sh
just dev        # https://localhost:5173
```

## URLs

Every frame answers on two URL forms:

| form | example | why |
|---|---|---|
| subdomain | `https://markdown.mtfm.io/#?md=…` | what published metapages already embed — these URLs keep working |
| path | `https://mtfm.io/markdown/#?md=…` | one origin, and what dev uses |

Subdomain requests are rewritten to the path form before Fresh routes them, so
there is exactly one route per frame. See [`lib/host.ts`](./lib/host.ts) and the
`App.handler()` override in [`main.ts`](./main.ts).

Each frame also serves:

- `/<frame>/metaframe.json` — the definition the embedding metapage reads
- `/<frame>/README.md` — the in-app help, rendered by the markdown frame

Both are CORS-open, because metaframes are always embedded cross-origin.

## Adding a frame

```sh
just new <name>     # scaffolds frames/<name>/ from ./templates
```

A frame is four files:

```
frames/<name>/frame.ts            metadata: title, hosts[], metaframe.json, headers
frames/<name>/options.ts          declarative Options tab schema
frames/<name>/index.tsx           the route; computes the help URL server-side
frames/<name>/(_islands)/Main.tsx the UI
frames/<name>/README.md           in-app help
static/<name>/...                 images and other per-frame assets
```

Nothing central needs editing: [`lib/registry.ts`](./lib/registry.ts) picks up
`frames/*/frame.ts` with an eager glob.

Inside `frames/<name>/`, only `index.*` is a route — co-located modules are
excluded by the `ignore` rule in [`vite.config.ts`](./vite.config.ts). Islands go
in `(_islands)/`.

## What is shared

The point of the monorepo. Most of a metaframe used to be these:

| | |
|---|---|
| [`components/FrameShell.tsx`](./components/FrameShell.tsx) | Main / Options / Help tabs, the `hm` chrome modes, copy-URL button. Tabs mount on first use and stay mounted. |
| [`components/OptionsPanel.tsx`](./components/OptionsPanel.tsx) | the Options tab, driven by a frame's `FrameOption[]` and persisted to one hash param |
| [`lib/hash/useHashParam.ts`](./lib/hash/useHashParam.ts) | Preact hooks over `@metapages/hash-query`, wire-compatible with every published URL |
| [`lib/metaframe/useMetaframe.ts`](./lib/metaframe/useMetaframe.ts) | the metaframe postMessage protocol as hooks: inputs, outputs |
| [`components/CodeMirror.tsx`](./components/CodeMirror.tsx) | editor, grammars loaded on demand |

### The renderer is the page; everything else is the menu

A frame's renderer sits in one fixed position in a single element tree and is
never moved or unmounted by the chrome. Everything else — an editor, settings,
help — is *the menu*, and opens in one shared column beside it. Hiding the menu
hides all of it, so an embedded frame is just the renderer.

Two rules fall out of that, and both exist because breaking them caused real
bugs:

- **Never branch the element tree on chrome state.** Returning a different tree
  for "menu hidden" makes Preact recreate the renderer's DOM node. Any frame
  that writes its own HTML (markdown, and later mermaid, plotly, molstar,
  jsoncrack) then goes silently blank, because the effect that filled the node
  does not re-run. `FrameShell` renders one tree and toggles pieces inside it.

- **A frame that injects HTML must hold its node in state, not a ref.** Use a
  ref *callback* (`ref={setRoot}`) and put the node in the effect's deps, so
  the content is rewritten if the node is ever replaced:

  ```tsx
  const [root, setRoot] = useState<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!root) return;
    root.innerHTML = render(...);
  }, [root, ...]);
  return <div ref={setRoot} />;
  ```

The header holds **one** selection. Panels behave like tabs — opening one
closes the last — because two lit buttons read as two independent toggles.
Plain actions (copy, links) never render as selected. A panel may persist its
open state in a hash param (`edit` for the markdown editor) so a shared URL
reopens it; state travels between a panel and the renderer through hash params
only, so neither needs to know about the other.

### `hm` — how much chrome to show

Reproduced exactly from the metaframes this replaces, because published metapage
URLs set it:

| value | behaviour |
|---|---|
| absent / `visible` | chrome hidden when embedded, toggle button shown |
| `invisible` | toggle rendered but transparent, still clickable |
| `disabled` | no chrome and no toggle, ever |

Chrome renders only after mount: `isIframe()` is false during SSR, so deciding
server-side would flash chrome in every embed. These frames are hash-param
driven — the fragment never reaches the server — so the UI is an island by
nature.

## Weight

The page is small and renders content; anything heavier is fetched when it is
actually needed. Measured on the production build:

| | initial | after opening the editor |
|---|---|---|
| `/markdown` | 1.1 KB HTML + 329 KB JS | +610 KB |
| `/echo` | 1.3 KB HTML + 191 KB JS | — |

The rule for a new frame: **import a heavy dependency dynamically, inside the
component that needs it.** Vite then splits it into its own chunk and the
browser fetches it on mount, not on load.
[`components/CodeMirror.tsx`](./components/CodeMirror.tsx) is the worked
example — every CodeMirror import is dynamic and only the types are imported
statically, so a markdown frame opened read-only ships none of the editor.
The same applies to the frames still to migrate: pyodide, molstar, ffmpeg,
monaco and the tfjs models should each stay out of their frame's first load.

What legitimately belongs in the initial chunk is the frame's actual content
renderer (markdown-it for the markdown frame) and `@metapages/metapage`, which
has to connect to the parent metapage promptly to receive inputs.

## Commands

```sh
just                      # list commands and URLs
just dev                  # dev server, all frames, both URL forms
just check                # fmt, lint, type-check, unit tests
just build                # production build into ./_fresh
just start                # serve the build on Deno
just preview              # serve the build on workerd (the real runtime)
just preview-host markdown.mtfm.io   # ...as a frame subdomain
just deploy               # check, build, wrangler deploy
just logs                 # tail production logs
```

`just dev` serves over HTTPS once `mkcert` has run (it runs automatically). That
is not cosmetic: an https parent page cannot embed an http iframe, so testing a
frame the way it is actually used needs TLS locally.

## Deployment notes

- `wrangler.jsonc` points `main` at `_fresh/server.js`, which Fresh emits
  already shaped as `{ fetch }`.
- The Cloudflare Vite plugin is deliberately **not** used: it builds the worker
  environment in the same pass that produces `_fresh/server.js`, which the
  worker entry imports, so the build races itself. `vite build` then
  `wrangler deploy` has no such problem.
- Static files are served by Cloudflare's assets layer from `_fresh/client`, not
  by the Worker — Fresh's production build cache reads them with `Deno.open`,
  which does not exist on workerd.
- Because the assets layer answers before the Worker runs, it cannot see the
  subdomain rewrite. Per-frame assets must therefore be referenced as
  `/<frame>/…`; a frame's README has its relative image paths rewritten to that
  form when served (see [`lib/markdown/links.ts`](./lib/markdown/links.ts)).
- Production subdomains need a **proxied wildcard DNS record** for `*.mtfm.io`;
  Universal SSL covers one level of wildcard.
- `wrangler dev` pins the simulated hostname to the first `routes` entry, so use
  `just preview-host <host>` to exercise subdomain routing locally.

## Migration status

| frame | from | notes |
|---|---|---|
| `echo` | `metaframe-echo` | ✅ |
| `markdown` | `metaframe-markdown`, `metaframe-markdown-v2` | ✅ serves `markdown` + the legacy `markdownv2` alias; renders every frame's help |

The rest are still deployed from their own repos. The UI of each is rewritten to
Preact + Tailwind on migration — the originals are React 18 + Chakra UI v2, and
`preact/compat` plus emotion plus framer-motion is not a combination worth
carrying forward.
