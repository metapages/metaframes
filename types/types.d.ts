/// <reference types="vite/client" />

// A triple-slash reference rather than `import "vite/client"`: an import would
// make this file a module, and the ambient `declare module` below would stop
// being global.

declare module "virtual:frame-readmes" {
  /** frame directory name -> the contents of its README.md */
  const readmes: Record<string, string>;
  export default readmes;
}
