import { assertEquals } from "jsr:@std/assert@^1";
import { prefixRelativeAssets } from "./links.ts";

Deno.test("prefixRelativeAssets rewrites relative markdown images", () => {
  assertEquals(
    prefixRelativeAssets("![alt](./readme-images/a.png)", "markdown"),
    "![alt](/markdown/readme-images/a.png)",
  );
  assertEquals(
    prefixRelativeAssets("![](readme-images/a.png)", "markdown"),
    "![](/markdown/readme-images/a.png)",
  );
  assertEquals(
    prefixRelativeAssets("![](/readme-images/a.png)", "markdown"),
    "![](/markdown/readme-images/a.png)",
  );
});

Deno.test("prefixRelativeAssets rewrites relative <img> tags", () => {
  assertEquals(
    prefixRelativeAssets(
      '<img src="./readme-images/a.png" alt="x" />',
      "markdown",
    ),
    '<img src="/markdown/readme-images/a.png" alt="x" />',
  );
});

Deno.test("prefixRelativeAssets leaves absolute and already-prefixed paths", () => {
  for (
    const src of [
      "![](https://example.com/a.png)",
      "![](http://example.com/a.png)",
      "![](//example.com/a.png)",
      "![](data:image/png;base64,AAAA)",
      "![](/markdown/readme-images/a.png)",
    ]
  ) {
    assertEquals(prefixRelativeAssets(src, "markdown"), src, src);
  }
});

Deno.test("prefixRelativeAssets keeps markdown titles intact", () => {
  assertEquals(
    prefixRelativeAssets('![alt](./a.png "a title")', "echo"),
    '![alt](/echo/a.png "a title")',
  );
});
