/**
 * The editor frame against its published contract (static/editor/llms-full.txt).
 *
 * Every assertion here corresponds to something a published URL or an
 * embedding metapage already relies on, so this is the file to run before
 * touching that frame.
 */
import { chromium } from "playwright";
import {
  BASE,
  createReporter,
  embedAndExchange,
  enc,
  encJson,
  openFresh,
} from "./harness.mjs";

const FRAME = `${BASE}/editor`;
const { ok, section, done } = createReporter("editor frame");

const browser = await chromium.launch();
const ctx = await browser.newContext({
  ignoreHTTPSErrors: true,
  viewport: { width: 1100, height: 700 },
});
ctx.setDefaultTimeout(20000);
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));

const requests = [];
page.on("request", (r) => requests.push(r.url()));

const ready = async () => {
  await page.waitForSelector(".monaco-editor .view-lines", { timeout: 40000 });
  await page.waitForFunction(() => !!globalThis.monaco, { timeout: 40000 });
  await page.waitForTimeout(300);
};
const textOf = () =>
  page.evaluate(() => globalThis.monaco.editor.getModels()[0].getValue());
const languageOf = () =>
  page.evaluate(() => globalThis.monaco.editor.getModels()[0].getLanguageId());

section("Monaco is served by this deployment, not a CDN");
await openFresh(page, `${FRAME}/#?text=${enc("# Hello\n")}`);
await ready();
ok("the editor mounts", (await page.$(".monaco-editor")) !== null);
ok(
  "loader.js came from this origin",
  requests.some((u) => u.startsWith(BASE) && u.endsWith("/vs/loader.js")),
);
ok(
  "nothing was fetched from a public CDN",
  !requests.some((u) => /cdn\.jsdelivr\.net|unpkg\.com|cdnjs\./.test(u)),
  JSON.stringify(requests.filter((u) => /cdn|unpkg/.test(u)).slice(0, 3)),
);

section("the published text encoding");
ok("text from the hash is in the editor", (await textOf()) === "# Hello\n");
// The whole reason the encoding is base64(uriEncode(s)) and not bare btoa.
const tricky = "50% done — héllo 😀\n";
await openFresh(page, `${FRAME}/#?text=${enc(tricky)}`);
await ready();
ok(
  "a % sign and non-Latin1 text round-trip",
  (await textOf()) === tricky,
  JSON.stringify(await textOf()),
);

section("options.mode");
for (
  const [label, mode, expected] of [
    ["a language id", "python", "python"],
    ["a file extension", "py", "python"],
    ["an unknown id", "notareallanguage", "plaintext"],
  ]
) {
  await openFresh(
    page,
    `${FRAME}/#?text=${enc("x=1")}&options=${encJson({ mode })}`,
  );
  await ready();
  ok(
    `${label} resolves to ${expected}`,
    (await languageOf()) === expected,
    await languageOf(),
  );
}
ok(
  "resolving an extension does not rewrite the shared URL",
  (await page.evaluate(() => location.hash)).includes(
    encJson({ mode: "notareallanguage" }),
  ),
);
await openFresh(page, `${FRAME}/#?text=${enc("{}")}`);
await ready();
ok(
  "mode defaults to json",
  (await languageOf()) === "json",
  await languageOf(),
);

section("options.theme drives the page and the editor together");
await openFresh(
  page,
  `${FRAME}/#?text=${enc("x")}&options=${encJson({ theme: "vs-dark" })}`,
);
await ready();
ok(
  "the page palette is dark",
  await page.evaluate(() => document.documentElement.dataset.theme) === "dark",
);
ok(
  "the editor is dark too",
  await page.evaluate(() => !!document.querySelector(".monaco-editor.vs-dark")),
);
await openFresh(page, `${FRAME}/#?text=${enc("x")}`);
await ready();
ok(
  "the default is light in both",
  await page.evaluate(() => !!document.querySelector(".monaco-editor.vs")),
);

section("display options");
await openFresh(
  page,
  `${FRAME}/#?text=${enc("x")}&options=${encJson({ readOnly: true })}`,
);
await ready();
ok(
  "readOnly makes the editor read-only",
  await page.evaluate(() =>
    globalThis.monaco.editor.getEditors()[0].getOption(
      globalThis.monaco.editor.EditorOption.readOnly,
    )
  ) === true,
);
ok("readOnly hides Save", (await page.$('button:has-text("Save")')) === null);

await openFresh(
  page,
  `${FRAME}/#?text=${enc("x")}&options=${encJson({ hideLineNumbers: true })}`,
);
await ready();
ok(
  "hideLineNumbers hides the gutter",
  (await page.$$(".monaco-editor .line-numbers")).length === 0,
);

section("Save, autosend and saveloadinhash");
await openFresh(page, `${FRAME}/#?text=${enc("start")}`);
await ready();
ok(
  "Save is shown by default",
  (await page.$('button:has-text("Save")')) !== null,
);
const before = await page.evaluate(() => location.hash);
await page.click(".monaco-editor .view-lines");
await page.keyboard.type("ABC");
await page.waitForTimeout(1200);
ok(
  "typing alone never rewrites the URL",
  (await page.evaluate(() => location.hash)) === before,
);
ok("the typed text is in the editor", (await textOf()).includes("ABC"));

await openFresh(
  page,
  `${FRAME}/#?text=${enc("start")}&options=${encJson({ autosend: true })}`,
);
await ready();
ok("autosend hides Save", (await page.$('button:has-text("Save")')) === null);

await openFresh(
  page,
  `${FRAME}/#?text=${enc("start")}&options=${
    encJson({ saveloadinhash: true })
  }`,
);
await ready();
await page.click(".monaco-editor .view-lines");
await page.keyboard.type("ABC");
await page.waitForTimeout(1200);
ok(
  "saveloadinhash without autosend still waits for Save",
  (await page.evaluate(() => location.hash)).includes(enc("start")),
);
await page.click('button:has-text("Save")');
await page.waitForTimeout(900);
const saved = await page.evaluate(() => {
  const m = /text=([^&]*)/.exec(location.hash);
  return m ? decodeURIComponent(atob(m[1])) : null;
});
ok(
  "Save writes the edited text into the URL",
  !!saved?.includes("ABC"),
  String(saved),
);

await openFresh(
  page,
  `${FRAME}/#?text=${enc("start")}&options=${
    encJson({ autosend: true, saveloadinhash: true })
  }`,
);
await ready();
await page.click(".monaco-editor .view-lines");
await page.keyboard.type("QQ");
await page.waitForTimeout(1500);
const live = await page.evaluate(() => {
  const m = /text=([^&]*)/.exec(location.hash);
  return m ? decodeURIComponent(atob(m[1])) : null;
});
ok(
  "autosend + saveloadinhash keeps the URL current while typing",
  !!live?.includes("QQ"),
  String(live),
);

section("the settings panel");
await openFresh(page, `${FRAME}/#?text=${enc("x")}&edit=true`);
await ready();
await page.click('button[aria-label="Settings"]');
await page.waitForSelector("#option-mode");
const labels = await page.$$eval(
  "label.eyebrow",
  (ls) => ls.map((l) => l.textContent.trim()),
);
for (
  const want of [
    "Language",
    "Read only",
    "Send on every keystroke",
    "Keep the text in the URL",
    "Wrap long lines",
    "Hide line numbers",
    "Focus on load",
    "Protect local edits",
    "Color scheme",
  ]
) {
  ok(`field present: ${want}`, labels.includes(want), JSON.stringify(labels));
}
const modes = await page.$$eval("#option-mode option", (os) => os.length);
ok("every pinned Monaco language is offered", modes === 84, String(modes));

section("the served definition");
const def = await (await fetch(`${FRAME}/metaframe.json`)).json();
ok("declares the text pipes", !!def.inputs?.text && !!def.outputs?.text);
ok(
  "declares text plus the shell's params",
  ["text", "edit", "editor", "hm", "options", "bgColor"].every((p) =>
    def.hashParams.includes(p)
  ),
  JSON.stringify(def.hashParams),
);
for (const doc of ["llms.txt", "llms-full.txt", "README.md"]) {
  const res = await fetch(`${FRAME}/${doc}`);
  ok(`${doc} is served`, res.status === 200, String(res.status));
}

section("live pipes, embedded");
const host = await ctx.newPage();
await host.goto(`${BASE}/`);
const exchange = await embedAndExchange(host, {
  src: `${FRAME}/#?options=${encJson({ autosend: true })}`,
  inputs: { text: "from the pipe" },
});
ok("the frame completes the metaframe handshake", exchange.connected);
const inner = host.frames().find((f) => f.url().includes("/editor"));
const innerText = await inner.evaluate(() =>
  globalThis.monaco.editor.getModels()[0].getValue()
);
ok(
  "an input pipe value lands in the editor",
  innerText === "from the pipe",
  JSON.stringify(innerText),
);
ok(
  "the frame emits on its output pipe",
  exchange.outputs.some((o) => o && "text" in o),
  JSON.stringify(exchange.outputs).slice(0, 200),
);
await host.close();

ok("no page errors", errors.length === 0, JSON.stringify(errors.slice(0, 3)));

await browser.close();
process.exit(done() ? 1 : 0);
