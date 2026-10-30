# [Metaframe](https://metapage.io/): Mol* structure viewer

Views molecular structures in the browser with
[Mol*](https://molstar.org/), driven entirely by its inputs and URL.

## Inputs

Matched by key and file extension, in priority order — the first match wins:

| priority | input | format |
|---|---|---|
| 1 | `pdb-id` (also `pdbid`, `pdbId`, `pdbID`) | a [PDB](https://www.rcsb.org/) id, e.g. `1cbs` |
| 2 | any key ending `.pdb` | PDB structure text |
| 3 | any key ending `.cif` | mmCIF structure text |
| 4 | a key ending `.xtc` **and** one ending `.gro` | gromacs trajectory + topology |

Any input may be a dataref (`{"type": "url", "value": "https://…"}`) instead of
the data itself; it is fetched before loading.

With no inputs at all, `#?pdbId=1cbs` in the URL loads a structure directly, so
the frame is useful standalone.

## Options

Open the menu and go to settings. Mol*'s own controls, sequence view and log are
hidden by default, which is what an embedded viewer usually wants; turn any of
them back on there. The PDB provider can be switched between `rcsb` and `pdbe`.

Settings are stored in the URL, so a configured viewer is shareable as it
stands.

## Saved view

Changes you make inside Mol* are written back to the URL, in a `view` hash
param, so the viewer you are looking at is the viewer you share:

- **panel layout** — expanded, controls shown, which regions are open
- **camera** — where you moved it
- **renderer settings** — background, lighting, quality and the rest

**Only what you changed is stored.** The viewer's own defaults are never
written, and each setting is recorded on its own: turning on the controls
panel adds `{"layout":{"showControls":true}}` and nothing else. Change it back
and it drops out again; put everything back and the `view` param disappears
entirely. A frame you only look at keeps a clean URL.

That keeps shared links small — a single changed setting costs about 70
characters, and a changed layout, background and camera together about 300.

**What is not saved:** the structure tree — representations, selections,
components added through Mol*'s own controls. Mol*'s full state snapshot is
about 15 KB of JSON for a small structure, roughly 37 KB once encoded into a
hash, and it grows with the structure, so it does not belong in a URL. If you
need that, send the snapshot through a metaframe input instead of the URL.

## Source

[https://github.com/metapages/metaframes](https://github.com/metapages/metaframes)
