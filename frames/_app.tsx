import { define } from "../utils.ts";
import {
  DEFAULT_COLOR_SCHEME,
  themeAttributeFor,
} from "../lib/hash/useColorScheme.ts";

export default define.page(function App({ Component, state }) {
  const title = state.frame?.definition.metadata.title ??
    state.frame?.title ??
    "metaframes";
  const description = state.frame?.description;
  /**
   * A frame's palette, pre-set in the server-rendered HTML.
   *
   * The scheme actually in force lives in the URL fragment, which the server
   * cannot see, so this is the default — and the default is the common case,
   * which is what keeps a frame from flashing a dark theme before
   * useHashParamColorScheme runs. A page that is not a frame (the gallery) is
   * not transparent and follows the viewer's device instead.
   */
  const theme = state.frame
    ? themeAttributeFor(DEFAULT_COLOR_SCHEME)
    : undefined;
  return (
    <html data-theme={theme ?? undefined}>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>{title}</title>
        {description ? <meta name="description" content={description} /> : null}
      </head>
      <body>
        <Component />
      </body>
    </html>
  );
});
