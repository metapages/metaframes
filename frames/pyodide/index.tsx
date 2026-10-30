import { define } from "../../utils.ts";
import { helpConfig } from "../../lib/help.ts";
import { PyodideRunner } from "./(_islands)/PyodideRunner.tsx";

export default define.page(function PyodidePage() {
  return <PyodideRunner help={helpConfig("pyodide")} />;
});
