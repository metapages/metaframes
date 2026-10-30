import { define } from "../../utils.ts";
import { helpConfig } from "../../lib/help.ts";
import { MolstarViewer } from "./(_islands)/MolstarViewer.tsx";

export default define.page(function MolstarPage() {
  return <MolstarViewer help={helpConfig("molstar")} />;
});
