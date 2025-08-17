#!/usr/bin/env bash
set -o errexit
set -o pipefail
set -x

rm -rf coverage

tsc --project tsconfig.dev.json
sass --no-source-map src/fast-grid-layout.scss docs/css/fast-grid-layout.css

c8 --include src --include docs/js/fast-grid-layout.js --reporter text --reporter lcov playwright test $1 $2 $3
