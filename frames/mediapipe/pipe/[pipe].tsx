import { define } from "../../../utils.ts";
import { isPipe, pipeDocument } from "../pipes.ts";

/**
 * One MediaPipe pipe, served as its own document.
 *
 * A raw Response rather than a rendered page: these are vendored standalone
 * pages with their own CSS and CDN scripts, and _app.tsx would wrap them in
 * this app's document instead. Nothing here needs the shell — a pipe is a
 * full-bleed camera view that reports landmarks to the metapage embedding it.
 *
 * Both published URL forms work, and both trailing-slash spellings of each:
 * the document resolves its own module URL in the browser (see pipeDocument).
 */
export const handler = define.handlers({
  GET(ctx) {
    const name = ctx.params.pipe;
    if (!isPipe(name)) return ctx.next();
    return new Response(pipeDocument(name), {
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  },
});
