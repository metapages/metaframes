import { define } from "../../utils.ts";
import { helpConfig } from "../../lib/help.ts";
import { Echo } from "./(_islands)/Echo.tsx";

export default define.page(function EchoPage() {
  return <Echo help={helpConfig("echo")} />;
});
