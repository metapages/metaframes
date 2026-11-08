/**
 * The MediaPipe pipes, and the one document that serves all of them.
 *
 * Each pipe is a vendored standalone page, not a Preact island: it drives a
 * <video> and a <canvas> directly, loads MediaPipe from a CDN, and reports
 * landmarks through the Metaframe SDK on `globalThis`. That is deliberately
 * left alone — rewriting working computer-vision code into JSX would risk the
 * only thing these pages do, and the shell has nothing to add to a full-bleed
 * camera view.
 *
 * What *was* worth doing is the head. The four documents in the mediapipe repo
 * were 98% identical copies, differing only in the title, which @mediapipe
 * bundle they load, whether ella-math is needed and one CSS line. They are one
 * template here with a four-row table, so a change to the bootstrap happens
 * once.
 */

/** A MediaPipe solution bundle, pinned exactly as the originals pinned it. */
const SOLUTION = {
  hands: "@mediapipe/hands@0.4.1675469240/hands.js",
  pose: "@mediapipe/pose@0.5.1675469404/pose.js",
  holistic: "@mediapipe/holistic@0.5.1675471629/holistic.js",
} as const;

export interface Pipe {
  /** Shown on the index and as the document title. */
  title: string;
  description: string;
  /** MediaPipe bundles to load, in the order the original loaded them. */
  solutions: (keyof typeof SOLUTION)[];
  /**
   * Load ella-math. Only the pipes that reach control/hands.js need it:
   * control/hands-palm-orthgonal-direction.js uses its `Vec` global.
   */
  math?: boolean;
  /**
   * Mirror the webcam feed as well as the canvas overlay. The canvas is always
   * mirrored so the landmarks track the way a mirror would; pose-and-hands
   * mirrors the video under it too.
   */
  mirrorVideo?: boolean;
}

/** Insertion order is the order the index lists them in. */
export const PIPES: Record<string, Pipe> = {
  hands: {
    title: "Hands",
    description:
      "Hand landmarks, plus derived controls: clench, splay, wrist rotation and palm angles.",
    solutions: ["hands"],
    math: true,
  },
  pose: {
    title: "Pose",
    description: "Body pose landmarks and segmentation masks.",
    solutions: ["pose"],
  },
  "pose-and-hands": {
    title: "Pose and Hands",
    description:
      "Hand landmarks transformed by body pose, so hand positions are relative to the body rather than the frame.",
    solutions: ["hands", "pose"],
    math: true,
    mirrorVideo: true,
  },
  holistic: {
    title: "Holistic",
    description: "Pose, hands and face landmarks together, in one pass.",
    solutions: ["holistic"],
  },
};

export const PIPE_NAMES = Object.keys(PIPES);

export const isPipe = (name: string): boolean =>
  Object.hasOwn(PIPES, name) && name !== "__proto__";

const cdn = (path: string) => `https://cdn.jsdelivr.net/npm/${path}`;

/**
 * The page for one pipe.
 *
 * The module URL is computed in the browser rather than written into the
 * document, and that is not fussiness: `/pipe/hands` and `/pipe/hands/` are
 * the same route but different base directories, and the server cannot tell
 * them apart — rewritePathname() strips the trailing slash before any handler
 * runs (lib/host.ts). A `<base href>` picked server-side is therefore wrong
 * for one of the two forms, and `script.js` 404s. The browser does know which
 * URL it is on, so it works it out there, where the answer is not ambiguous.
 *
 * This also keeps both published URL shapes working with no origin baked in:
 * mediapipe.mtfm.io/pipe/hands and mtfm.io/mediapipe/pipe/hands resolve
 * `script.js` — and from inside it, `../control/*.js` — to the same files.
 *
 * Dropped on the way over: material-components-web, which all four pages
 * loaded from `@latest` and none of them used, and the `<base>` element it no
 * longer needs.
 */
export function pipeDocument(name: string): string {
  const pipe = PIPES[name];
  const scripts = [
    cdn("@mediapipe/drawing_utils/drawing_utils.js"),
    ...pipe.solutions.map((s) => cdn(SOLUTION[s])),
    ...(pipe.math ? [cdn("ella-math@1.3.2/dist/index.umd.js")] : []),
  ];

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1"/>
    <title>Mediapipe ${pipe.title}</title>

    <script type="module">
      import {Metapage, Metaframe} from "${
    cdn("@metapages/metapage@1.8.3/dist/index.js")
  }";

      // The pipe scripts are plain modules, not bundled with the SDK: they
      // reach for these on globalThis.
      globalThis.metapage = { Metapage, Metaframe };
      if (!globalThis.metaframe) {
        globalThis.metaframe = new Metaframe();
      }
      var metaframe = globalThis.metaframe;

      // The pipe's own directory, whichever URL form this is. A relative URL
      // resolves against the directory, so "/pipe/hands" needs "hands/" and
      // "/pipe/hands/" needs "./" — both land on /pipe/hands/script.js.
      const dir = location.pathname.endsWith("/") ? "./" : "${name}/";
      import(new URL(dir + "script.js", location.href).href);
    </script>
    <style>
      body {
        margin: 0;
        padding: 0;
        background-color: transparent;
      }

      #canvas-wrapper {
        width: 100vw;
        display: flex;
        justify-content: flex-start;
        align-items: flex-start;
        height: 100vh;
        overflow: hidden;
        gap: 0;
        background-color: transparent;
        position: relative;
      }

      #output-canvas {
        display: block;
        max-width: 100%;
        max-height: 100%;
        object-fit: contain;
        position: absolute;
        top: 0;
        left: 0;
        transform: scaleX(-1);
      }

      #webcam {
        display: block;
        max-width: 100%;
        max-height: 100%;
        object-fit: contain;
        position: absolute;
        top: 0;
        left: 0;${pipe.mirrorVideo ? "\n        transform: scaleX(-1);" : ""}
      }
    </style>
${
    scripts.map((src) =>
      `    <script src="${src}" crossorigin="anonymous"></script>`
    ).join("\n")
  }
  </head>

  <body>
    <div id="canvas-wrapper">
      <video id="webcam" autoplay="autoplay" playsinline="playsinline"></video>
      <canvas class="output" id="output-canvas"></canvas>
    </div>
  </body>
</html>
`;
}
