import { define } from "../utils.ts";

export default define.page(function App({ Component, state }) {
  const title = state.frame?.definition.metadata.title ??
    state.frame?.title ??
    "metaframes";
  const description = state.frame?.description;
  return (
    <html>
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
