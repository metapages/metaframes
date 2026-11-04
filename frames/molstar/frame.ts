import type { FrameConfig } from "../../lib/registry.ts";
import { options, toolbar, wordmark } from "./config.ts";

export const frame: FrameConfig = {
  title: "Mol* structure viewer",
  description:
    "Views molecular structures — PDB ids, .pdb and .cif files, and gromacs trajectories — with Mol*.",
  hosts: ["molstar"],
  definition: {
    version: "2",
    metadata: {
      name: "molstar",
      title: "Mol* Structure Viewer",
      description: "Molecular structure viewer powered by Mol*",
      tags: ["molecule", "structure", "pdb", "molstar", "3d", "science"],
    },
    // Inputs are matched by key and extension, in priority order:
    // a PDB id, then *.pdb, then *.cif, then an *.xtc + *.gro pair.
    inputs: {
      "pdb-id": {
        type: "pdb/id",
        description: "PDB id, https://www.rcsb.org/",
      },
      "target.pdb": { type: "chemical/x-pdb", description: "PDB structure" },
      "target.cif": { type: "chemical/x-cif", description: "mmCIF structure" },
      "target.xtc": { type: "gromacs/xtc", description: "gromacs trajectory" },
      "target.gro": { type: "gromacs/gro", description: "gromacs topology" },
    },
    outputs: {},
    hashParams: ["options", "pdbId", "view", "hm"],
  },
  wordmark,
  options,
  toolbar,
};
