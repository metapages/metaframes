/**
 * Every frame with a text editor, typed into like a person types.
 *
 * This is a regression test for a specific, severe bug rather than a general
 * smoke test. Both editor components guarded against their own edits echoing
 * back with a single "last emitted" slot. Typing several characters quickly
 * queues several state updates; Preact runs the sync effect once per queued
 * value; an effect carrying an older value compared it against a ref already
 * holding the newest, decided the text had come from outside, and wrote the
 * stale text back — which fired another change, forever. The page's main
 * thread stopped responding on the second keystroke.
 *
 * It shipped to production in the markdown and pyodide frames. Nothing else
 * caught it: it needs a real browser, a real editor, and more than one
 * keystroke.
 */
import { chromium } from "playwright";
import {
  BASE,
  createReporter,
  enc,
  openFresh,
  typeOrHang,
} from "./harness.mjs";

const PHRASE = "XYZ hello world 12345";

/** Each frame, its document hash param, and how to reach its editor. */
const FRAMES = [
  {
    name: "editor",
    param: "text",
    selector: ".monaco-editor .view-lines",
    read: (page) =>
      page.evaluate(() => globalThis.monaco.editor.getModels()[0].getValue()),
  },
  {
    name: "markdown",
    param: "md",
    panel: "Editor",
    selector: ".cm-content",
    read: (page) =>
      page.evaluate(() =>
        document.querySelector(".cm-content")?.textContent ?? ""
      ),
  },
  {
    name: "pyodide",
    param: "py",
    panel: "Editor",
    selector: ".cm-content",
    read: (page) =>
      page.evaluate(() =>
        document.querySelector(".cm-content")?.textContent ?? ""
      ),
  },
];

const { ok, section, done } = createReporter("editors");
const browser = await chromium.launch();

for (const frame of FRAMES) {
  section(`${frame.name}: typing does not wedge the page`);
  const ctx = await browser.newContext({
    ignoreHTTPSErrors: true,
    viewport: { width: 1200, height: 700 },
  });
  ctx.setDefaultTimeout(15000);
  const page = await ctx.newPage();

  const url = `${BASE}/${frame.name}/#?${frame.param}=${
    enc("start\n")
  }&edit=true`;
  await openFresh(page, url);

  if (frame.panel) {
    try {
      await page.click(`button[aria-label="${frame.panel}"]`, {
        timeout: 8000,
      });
    } catch {
      // Already the open panel.
    }
  }

  let mounted = true;
  try {
    await page.waitForSelector(frame.selector, { timeout: 30000 });
  } catch {
    mounted = false;
  }
  ok(`${frame.name}: the editor mounts`, mounted);

  if (mounted) {
    await page.click(frame.selector);
    let typed = true;
    try {
      await typeOrHang(page, PHRASE);
    } catch {
      typed = false;
    }
    ok(
      `${frame.name}: the page survives ${PHRASE.length} fast keystrokes`,
      typed,
    );

    if (typed) {
      const text = await frame.read(page);
      ok(
        `${frame.name}: every character landed`,
        text.includes(PHRASE),
        JSON.stringify(text.slice(0, 80)),
      );
    }
  }

  await ctx.close();
}

await browser.close();
process.exit(done() ? 1 : 0);
