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
    <div class="h-full w-full bg-surface p-4">
      {
        /* The padding is here, not in the markdown frame. A frame renders flush
           to its own edges so an embedding page is never stuck with space it
           cannot remove; this panel is that embedding page, and a README
           touching the panel's border reads as a bug. */
      }
      <iframe
        class="h-full w-full border-0"
        src={url}
        title="Help"
      />
    </div>
  );
}
