/**
 * A frame's help document, rendered by this deployment's own markdown frame.
 *
 * Every existing metaframe does this with an iframe at
 * `https://markdown.mtfm.io/#?url=<origin>/README.md`. The `url` value is
 * passed UNENCODED, matching the deployed convention: the hash parser splits
 * only on `&` and the first `=`, and the markdown frame reads the raw stored
 * value — percent-encoding it would make it fetch a mangled URL.
 *
 * `url` is computed server-side (see each frame's index.tsx) so it points at
 * this deployment rather than production, in whichever URL form is in use.
 */
export function HelpPanel({ url }: { url: string }) {
  return (
    <iframe
      class="h-full w-full border-0 bg-surface"
      src={url}
      title="Help"
    />
  );
}
