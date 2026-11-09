import { define } from "../../utils.ts";
import { helpConfig } from "../../lib/help.ts";
import { EditorView } from "./(_islands)/EditorView.tsx";

export default define.page(function EditorPage() {
  return <EditorView help={helpConfig("editor")} />;
});
