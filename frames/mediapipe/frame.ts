import type { FrameConfig } from "../../lib/registry.ts";
import { PIPE_NAMES } from "./pipes.ts";

/**
 * Migrated from ../mediapipe, which was its own Deno Deploy service.
 *
 * One frame, four metaframes. The embeddable things here are the pipes, each
 * with its own metaframe.json under static/mediapipe/pipe/<name>/ — this entry
 * exists because they share a hostname, and `mediapipe.mtfm.io/pipe/hands` is
 * the URL already embedded in people's metapages. Splitting the pipes into
 * four frames would give each its own subdomain and break every one of those.
 *
 * No `headers`: a pipe needs the camera, but that is granted by the embedding
 * iframe's `allow` attribute, which each pipe's metaframe.json requests. There
 * is no response header to set.
 */
export const frame: FrameConfig = {
  title: "MediaPipe",
  description:
    "Camera-driven landmark detection — hands, pose, holistic — streamed as metaframe outputs. One metaframe per pipe.",
  hosts: ["mediapipe"],
  definition: {
    version: "2",
    metadata: {
      name: "mediapipe",
      title: "MediaPipe",
      description:
        "An index of the MediaPipe pipes. The embeddable metaframes are the pipes themselves, at /pipe/<name>.",
      tags: ["mediapipe", "camera", "landmarks", ...PIPE_NAMES],
    },
  },
  wordmark: "mediapipe",
};
