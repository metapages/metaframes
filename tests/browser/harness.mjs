/**
 * Shared helpers for the browser tests.
 *
 * These exist because the frames' worst failures are not type errors or unit
 * test failures — they are things that only happen in a real browser, under
 * real input. The editor loop these caught wedged the page's main thread on
 * the second keystroke and was invisible to `deno check`, to `deno test`, and
 * to any test that typed a single character.
 */

export const BASE = process.env.BASE || "https://localhost:5173";

/** The published encoding for `text`, `md`, `py`, … — llms-full.txt §2. */
export const enc = (s) => Buffer.from(encodeURIComponent(s)).toString("base64");
export const encJson = (o) => enc(JSON.stringify(o));

export function createReporter(title) {
  let pass = 0;
  let fail = 0;
  const ok = (name, condition, extra = "") => {
    if (condition) {
      pass++;
      console.log(`  ok  ${name}`);
    } else {
      fail++;
      console.log(`  NO  ${name} ${extra}`);
    }
  };
  const section = (name) => console.log(`\n[${name}]`);
  const done = () => {
    console.log(`\n${title}: ${pass} passed, ${fail} failed`);
    return fail;
  };
  return { ok, section, done };
}

/**
 * A fresh mount.
 *
 * `page.goto` to a URL differing only in the fragment is a same-document
 * navigation, so the app keeps its state — including one step's unapplied form
 * edits, which then block the next step.
 */
export async function openFresh(page, url) {
  await page.goto("about:blank");
  await page.goto(url, { waitUntil: "networkidle" });
}

/**
 * Speak the parent half of the metaframe protocol to an embedded frame.
 *
 * The real protocol, observed rather than guessed: JSON-RPC 2.0 over
 * postMessage. The frame sends `SetupIframeClientRequest` on a retry loop
 * until a parent answers with `SetupIframeServerResponse`; after that it
 * accepts messages whose `parentId` and `iframeId` match the handshake, and
 * sends its outputs as `OutputsUpdate` with the pipe values as `params`.
 *
 * Returns what the frame emitted, so a test can assert on real pipe traffic
 * rather than on an internal function.
 */
export async function embedAndExchange(
  hostPage,
  { src, inputs, settleMs = 2500 },
) {
  return await hostPage.evaluate(
    async ({ src, inputs, settleMs }) => {
      const PARENT = "testparent";
      const outputs = [];
      let connected = false;

      const frame = document.createElement("iframe");
      frame.src = src;
      frame.style.cssText = "width:700px;height:420px;border:0;display:block";

      const reply = (method, params) =>
        frame.contentWindow?.postMessage(
          { jsonrpc: "2.0", method, params, iframeId: "", parentId: PARENT },
          "*",
        );

      globalThis.addEventListener("message", (event) => {
        const data = event.data;
        if (!data || data.jsonrpc !== "2.0") return;
        if (data.method === "SetupIframeClientRequest") {
          // Answer every retry; the client ignores duplicates once resolved.
          reply("SetupIframeServerResponse", {
            version: "2",
            parentId: PARENT,
          });
          connected = true;
        } else if (data.method === "OutputsUpdate") {
          outputs.push(data.params);
        }
      });

      document.body.appendChild(frame);

      // Let the handshake happen, then send the inputs.
      await new Promise((r) => setTimeout(r, 2000));
      if (inputs) reply("InputsUpdate", { inputs });
      await new Promise((r) => setTimeout(r, settleMs));
      return { connected, outputs };
    },
    { src, inputs, settleMs },
  );
}

/**
 * Type into an editor and fail loudly if the page stops responding.
 *
 * A wedged main thread makes every later Playwright call hang forever rather
 * than time out, so the whole run looks like a slow test instead of a bug.
 */
export async function typeOrHang(page, text, ms = 8000) {
  await Promise.race([
    page.keyboard.type(text),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("page stopped responding")), ms)
    ),
  ]);
}
