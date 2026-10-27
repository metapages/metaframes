import { define } from "../utils.ts";
import { FRAME_LIST } from "../lib/registry.ts";
import { frameBaseUrlFrom, hostLabel } from "../lib/host.ts";

export default define.page(function Index({ url }) {
  // On a frame subdomain the apex route is never reached (the request is
  // rewritten to that frame), so this always renders on the apex.
  // Note: Fresh's dev server drops the port here, so these read as
  // https://localhost/<frame> in dev. The links themselves are relative and
  // correct; only the displayed text is approximate.
  const apex = url.host;
  const subdomainsAvailable = hostLabel(apex) === null;

  return (
    <div class="min-h-dvh bg-paper">
      <div class="mx-auto max-w-3xl px-6 py-12">
        <header class="border-b border-line pb-6">
          <span class="eyebrow">metapages</span>
          <h1 class="mt-2 font-mono text-2xl font-medium tracking-[0.02em] text-ink">
            metaframes
          </h1>
          <p class="mt-3 max-w-xl text-[0.9375rem] leading-relaxed text-ink-2">
            Embeddable, URL-configurable web apps for{" "}
            <a
              href="https://metapage.io"
              class="text-accent underline underline-offset-2"
            >
              metapages
            </a>. Each frame is served on its own path and its own subdomain.
          </p>
        </header>

        <ul class="mt-2">
          {FRAME_LIST.map((frame) => {
            const pathUrl = `${url.protocol}//${apex}/${frame.name}`;
            const hostUrl = frameBaseUrlFrom(
              frame.name,
              frame.hosts[0],
              url.protocol,
              apex,
            );
            return (
              <li
                key={frame.name}
                class="border-b border-line py-6"
              >
                <div class="flex items-baseline gap-3">
                  <a
                    href={`/${frame.name}`}
                    class="text-lg font-medium text-ink underline decoration-line-strong underline-offset-4 hover:decoration-accent"
                  >
                    {frame.title}
                  </a>
                  <code class="eyebrow">{frame.name}</code>
                </div>
                <p class="mt-2 max-w-xl text-sm leading-relaxed text-ink-2">
                  {frame.description}
                </p>
                <div class="mt-4 flex flex-col gap-1 font-mono text-xs text-ink-3">
                  <span>{pathUrl}</span>
                  {subdomainsAvailable && hostUrl !== pathUrl && (
                    <span>{hostUrl}</span>
                  )}
                </div>
                <div class="mt-4 flex gap-4">
                  <a
                    href={`/${frame.name}/metaframe.json`}
                    class="eyebrow hover:text-ink"
                  >
                    metaframe.json
                  </a>
                  <a
                    href={`/${frame.name}/README.md`}
                    class="eyebrow hover:text-ink"
                  >
                    readme.md
                  </a>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
});
