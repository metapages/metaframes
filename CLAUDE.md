# Two stage major refactor and vendor migration

## Goals

1. Migrate metaframes from deno deploy to cloudflare: deno deploy is shutting down in 6 months
2. Merge all the existing metaframes into a monorepo in this directory, with each metaframe its own directory under ./frames/
3. This is a single fresh server serving this content, prefer to migrate away from client builds and use SSR
4. Some rare metaframes need server headers e.g. bluetooth
5. This will be deployed to cloudflare https://usefresh.dev/docs/deployment/cloudflare-workers
6. Create reusable metaframe classes and code to re-use when possible, there will be so many repetitive parts
7. If you're unsure if it's worth migrating a metaframe, leave it for now and ask me later
8. There was a previous attempt in ../metaframes-all so check that out, but we aren't using deno
9. Create a justfile and have "just dev" start the dev server, we don't need docker I think, just fresh server, we can use mkcert to generate localhost certs


## Probable metaframes

All in the parent directory

metaframe-jsoncrack
metaframe-map
metaframe-markdown
metaframe-markdown-v2
metaframe-matterjs-simulation-control
mediapipe
mediasoup
metaframe-midi
metaframe-aws-s3-explorer
metaframe-molstar
metaframe-molstar-fresh
metaframe-bluetooth
metaframe-predictor-conv-1d-net
metaframe-download
metaframe-echo
metaframe-sound
metaframe-editor
metaframe-table
metaframe-ffmpeg
metaframe-table-from-js
metaframe-generator
metaframe-hands
metaframe-video
metaframe-home-assistant
metaframe-widgets
metaframe-image-capture
metaframes-all
metaframe-imu-controls
metaframe-inputs
passthrough
spells-and-effects