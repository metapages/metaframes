import { define } from "../../utils.ts";
import { helpUrl } from "../../lib/help.ts";
import { Echo } from "./(_islands)/Echo.tsx";

export default define.page(function EchoPage({ url }) {
  // Computed server-side so help resolves to this deployment, in whichever
  // URL form the request came in on.
  return <Echo helpUrl={helpUrl("echo", url.protocol, url.host)} />;
});
