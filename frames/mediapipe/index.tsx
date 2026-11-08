import { define } from "../../utils.ts";
import { hostLabel } from "../../lib/host.ts";
import { PIPES } from "./pipes.ts";

/**
 * The pipe index.
 *
 * Plain SSR, no shell: this is a directory, not a metaframe. The metaframes
 * are the pipes it links to, each with its own metaframe.json. The old
 * deployment served the Fresh starter logo here and kept the list at `/pipe/`;
 * both land here now (frames/mediapipe/pipe/index.tsx renders this too).
 *
 * Links are absolute from the frame root rather than relative, because this
 * page answers on four URLs — `/mediapipe`, `/mediapipe/pipe`, and either with
 * a trailing slash — and a relative href means something different on each.
 * The frame root depends only on which URL form the browser used, which the
 * Host header still says.
 */
export default define.page(function MediapipeIndex({ url }) {
  // On a frame subdomain the frame *is* the site root; on the apex it is a
  // path segment.
  const root = hostLabel(url.host) ? "" : "/mediapipe";

  return (
    <div class="min-h-dvh bg-paper">
      <div class="mx-auto max-w-3xl px-6 py-12">
        <header class="border-b border-line pb-6">
          <span class="eyebrow">metaframe</span>
          <h1 class="mt-2 font-mono text-2xl font-medium tracking-[0.02em] text-ink">
            mediapipe
          </h1>
          <p class="mt-3 max-w-xl text-[0.9375rem] leading-relaxed text-ink-2">
            Camera-driven landmark detection, one metaframe per pipe. Each
            streams landmarks and derived controls as outputs; connect one to
            anything that takes them.
          </p>
        </header>

        <ul class="mt-2">
          {Object.entries(PIPES).map(([name, pipe]) => (
            <li key={name} class="border-b border-line py-6">
              <div class="flex items-baseline gap-3">
                <a
                  href={`${root}/pipe/${name}`}
                  class="text-lg font-medium text-ink underline decoration-line-strong underline-offset-4 hover:decoration-accent"
                >
                  {pipe.title}
                </a>
                <code class="eyebrow">{name}</code>
              </div>
              <p class="mt-2 max-w-xl text-sm leading-relaxed text-ink-2">
                {pipe.description}
              </p>
              <div class="mt-4">
                <a
                  href={`${root}/pipe/${name}/metaframe.json`}
                  class="eyebrow hover:text-ink"
                >
                  metaframe.json
                </a>
              </div>
            </li>
          ))}
        </ul>

        <p class="mt-8 text-sm leading-relaxed text-ink-3">
          A pipe asks for the camera as soon as it loads, and draws the
          landmarks it finds over the video. Embedded in a metapage, the
          embedding iframe has to grant{" "}
          <code class="font-mono">camera</code>; each pipe's metaframe.json
          requests it.
        </p>
      </div>
    </div>
  );
});
