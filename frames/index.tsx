import { define } from "../utils.ts";
import { FRAME_LIST } from "../lib/registry.ts";
import { frameBaseUrlFrom, hostLabel } from "../lib/host.ts";

export default define.page(function Index({ url }) {
  // On a frame subdomain the apex route is never reached (the request is
  // rewritten to that frame), so this always renders on the apex.
  const apex = url.host;
  const subdomainsAvailable = hostLabel(apex) === null;

  return (
    <div class="min-h-dvh bg-gray-50">
      <div class="max-w-3xl mx-auto px-6 py-10">
        <h1 class="text-2xl font-semibold text-gray-900">metaframes</h1>
        <p class="mt-2 text-gray-600">
          Embeddable, URL-configurable web apps for{" "}
          <a
            href="https://metapage.io"
            class="text-blue-600 underline"
          >
            metapages
          </a>. Each frame is served on its own path and its own subdomain.
        </p>

        <ul class="mt-8 flex flex-col gap-3">
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
                class="bg-white border border-gray-200 rounded-lg p-4"
              >
                <div class="flex items-baseline gap-2 flex-wrap">
                  <a
                    href={`/${frame.name}`}
                    class="text-lg font-medium text-blue-700 underline"
                  >
                    {frame.title}
                  </a>
                  <code class="text-xs text-gray-400">{frame.name}</code>
                </div>
                <p class="mt-1 text-sm text-gray-600">{frame.description}</p>
                <div class="mt-3 flex flex-col gap-1 text-xs text-gray-500 font-mono">
                  <span>{pathUrl}</span>
                  {subdomainsAvailable && hostUrl !== pathUrl && (
                    <span>{hostUrl}</span>
                  )}
                </div>
                <div class="mt-3 flex gap-3 text-xs">
                  <a
                    href={`/${frame.name}/metaframe.json`}
                    class="text-gray-500 underline"
                  >
                    metaframe.json
                  </a>
                  <a
                    href={`/${frame.name}/README.md`}
                    class="text-gray-500 underline"
                  >
                    README.md
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
