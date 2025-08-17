#!/usr/bin/env bash
set -o errexit
set -o nounset
set -o pipefail
set -x

(trap 'kill 0' SIGINT; \
  tsc --project tsconfig.dev.json --watch --preserveWatchOutput & \
  sass --no-source-map --watch src/fast-grid-layout.scss docs/css/fast-grid-layout.css & \
  s4d docs & \
  wait)
