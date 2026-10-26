import { define } from "../../utils.ts";
import { helpUrl } from "../../lib/help.ts";
import { MarkdownView } from "./(_islands)/MarkdownView.tsx";

export default define.page(function MarkdownPage({ url }) {
  return <MarkdownView helpUrl={helpUrl("markdown", url.protocol, url.host)} />;
});
