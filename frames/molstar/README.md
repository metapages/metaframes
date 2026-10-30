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

## Source

[https://github.com/metapages/metaframes](https://github.com/metapages/metaframes)
