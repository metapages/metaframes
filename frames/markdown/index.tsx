import { define } from "../../utils.ts";
import { helpConfig } from "../../lib/help.ts";
import { MarkdownView } from "./(_islands)/MarkdownView.tsx";

export default define.page(function MarkdownPage() {
  return <MarkdownView help={helpConfig("markdown")} />;
});
