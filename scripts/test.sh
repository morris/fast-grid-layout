#!/usr/bin/env bash
set -o errexit
set -o pipefail
set -x

tsc --project tsconfig.dev.json
sass --no-source-map src/fast-grid-layout.scss docs/css/fast-grid-layout.css

playwright test $1 $2 $3
