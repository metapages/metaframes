import type { FrameOption, ToolbarItem } from "../../lib/registry.ts";

// A frame's client-shareable configuration. Imported by BOTH frame.ts (for the
// registry, which the server reads) and the frame's island (which renders it).

/** Mono wordmark in the header, the way framejs.io shows "js". */
export const wordmark = "ed";

/**
 * Every language Monaco 0.43.0 registers, which is the version this
 * deployment serves (see `just _monaco`). This is the published list — the
 * one `llms-full.txt` documents as "90 ids" — so a static array cannot drift
 * from what the editor actually accepts while the version is pinned.
 *
 * Monaco's six `freemarker2.tag-*.interpolation-*` variants are left out of
 * the dropdown: they are reachable by typing the id into the URL, and they
 * would be six near-identical rows in a list someone has to scroll.
 */
export const LANGUAGES = [
  "abap",
  "aes",
  "apex",
  "azcli",
  "bat",
  "bicep",
  "c",
  "cameligo",
  "clojure",
  "coffeescript",
  "cpp",
  "csharp",
  "csp",
  "css",
  "cypher",
  "dart",
  "dockerfile",
  "ecl",
  "elixir",
  "flow9",
  "freemarker2",
  "fsharp",
  "go",
  "graphql",
  "handlebars",
  "hcl",
  "html",
  "ini",
  "java",
  "javascript",
  "json",
  "julia",
  "kotlin",
  "less",
  "lexon",
  "liquid",
  "lua",
  "m3",
  "markdown",
  "mdx",
  "mips",
  "msdax",
  "mysql",
  "objective-c",
  "pascal",
  "pascaligo",
  "perl",
  "pgsql",
  "php",
  "pla",
  "plaintext",
  "postiats",
  "powerquery",
  "powershell",
  "proto",
  "pug",
  "python",
  "qsharp",
  "r",
  "razor",
  "redis",
  "redshift",
  "restructuredtext",
  "ruby",
  "rust",
  "sb",
  "scala",
  "scheme",
  "scss",
  "shell",
  "sol",
  "sparql",
  "sql",
  "st",
  "swift",
  "systemverilog",
  "tcl",
  "twig",
  "typescript",
  "vb",
  "verilog",
  "wgsl",
  "xml",
  "yaml",
];

/** The published default when `options.mode` is absent. */
export const DEFAULT_LANGUAGE = "json";

// `options.theme` is NOT here: it is the frame's colour scheme, which the
// shell contributes to every frame (components/shellOptions.ts) using this
// frame's own published vocabulary — `light` and `vs-dark` are Monaco theme
// ids, and this is where they came from. One setting, one key, both the page
// chrome and the editor's syntax colours.
//
// Every boolean below is absent-means-false, matching the published contract
// (llms-full.txt §4). The old settings panel pre-ticked `saveloadinhash` in
// its form while embeds without an `options` param got `false`, so the panel
// and the wire disagreed; the wire wins, because that is what published URLs
// were written against.
export const options: FrameOption[] = [
  {
    name: "mode",
    displayName: "Language",
    hint: "Syntax highlighting. A file extension such as `py` also works.",
    type: "option",
    options: LANGUAGES,
    default: DEFAULT_LANGUAGE,
  },
  {
    name: "readOnly",
    displayName: "Read only",
    hint: "Show the text without allowing edits. Hides the Save button.",
    type: "boolean",
  },
  {
    name: "autosend",
    displayName: "Send on every keystroke",
    hint:
      "Emit the text as it is typed, instead of waiting for the Save button.",
    type: "boolean",
  },
  {
    name: "saveloadinhash",
    displayName: "Keep the text in the URL",
    hint:
      "Write edits back into the URL, so the link is the document. Off means " +
      "the URL keeps whatever it was opened with.",
    type: "boolean",
  },
  {
    name: "wordWrap",
    displayName: "Wrap long lines",
    type: "boolean",
  },
  {
    name: "hideLineNumbers",
    displayName: "Hide line numbers",
    type: "boolean",
  },
  {
    name: "autoFocus",
    displayName: "Focus on load",
    hint: "Avoid on a page with several editors: they fight over the cursor.",
    type: "boolean",
  },
  {
    name: "blockLocalEditorStateOverwrites",
    displayName: "Protect local edits",
    hint:
      "Once something has been typed here, ignore incoming values so they do " +
      "not overwrite it.",
    type: "boolean",
  },
];

export const toolbar: ToolbarItem[] = [];
