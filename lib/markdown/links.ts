/**
 * Rewrite relative image references in a frame's README to root-relative paths
 * under that frame's prefix.
 *
 * Why this is needed: a frame's static assets live at `/<frame>/...` (Fresh
 * serves one static root, and on Cloudflare they are answered by the assets
 * layer before the Worker runs — so the Worker cannot rewrite them). On the
 * subdomain form, `markdown.mtfm.io/README.md` would resolve `./readme-images/x.png`
 * to `markdown.mtfm.io/readme-images/x.png`, which no layer can map back to the
 * frame prefix. Emitting `/markdown/readme-images/x.png` resolves correctly in
 * both URL forms.
 */
export function prefixRelativeAssets(
  markdown: string,
  frameName: string,
): string {
  const prefix = (path: string) => {
    if (/^(?:[a-z]+:)?\/\//i.test(path) || path.startsWith("data:")) {
      return path;
    }
    if (path.startsWith(`/${frameName}/`)) return path;
    const clean = path.replace(/^\.\//, "").replace(/^\//, "");
    return `/${frameName}/${clean}`;
  };

  return markdown
    .replace(
      /!\[([^\]]*)\]\(([^)\s]+)([^)]*)\)/g,
      (_m, alt, path, rest) => `![${alt}](${prefix(path)}${rest})`,
    )
    .replace(
      /(<img\s+[^>]*src=["'])([^"']+)(["'])/gi,
      (_m, head, path, tail) => `${head}${prefix(path)}${tail}`,
    );
}
