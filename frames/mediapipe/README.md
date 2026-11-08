# [Metaframe](https://metapages.org/): mediapipe

Camera-driven landmark detection with
[MediaPipe](https://ai.google.dev/edge/mediapipe), as metaframes. Each **pipe**
is its own metaframe: it opens the camera, draws the landmarks it finds over the
video, and streams them as outputs.

This page is an index. The embeddable URLs are the pipes.

## The pipes

| pipe | url | what it emits |
| --- | --- | --- |
| Hands | `/pipe/hands` | derived hand controls — clench, splay, wrist rotation, palm angles, index-finger angle |
| Pose | `/pipe/pose` | body pose landmarks, world landmarks, segmentation masks |
| Pose and Hands | `/pipe/pose-and-hands` | hand landmarks transformed by body pose |
| Holistic | `/pipe/holistic` | pose, hands and face landmarks together |

Every pipe also emits `timestamp`, the frame time in milliseconds.

## Hands

The hands pipe does more than report landmarks: it derives the controls you
would actually bind something to. Clench, splay, wrist rotation, palm
orientation (as both Euler angles and a quaternion) and index-finger angle, each
per hand, plus `…NotClenched` variants that follow whichever hand is open — so a
clenched hand stops driving whatever it was driving.

Raw landmarks are off by default, because they are large and most pipes do not
need them. Add `?emitRawHandData=true` to the URL to get a `hands` output with
the full MediaPipe result in it.

## The camera

A pipe asks for the camera the moment it loads. Embedded in a metapage, the
iframe has to grant it: each pipe's `metaframe.json` requests
`camera` (along with `fullscreen` and `cross-origin-isolated`) in its `allow`,
and the metapage passes that through.

Nothing is uploaded. Detection runs in the browser, on the GPU where one is
available; only the landmarks leave the frame, as metaframe outputs.

## Source

Migrated from
[https://github.com/metapages/mediapipe](https://github.com/metapages/mediapipe).
The pipe pages are the originals: vendored standalone documents that drive a
`<video>` and a `<canvas>` directly and load MediaPipe from a CDN.
