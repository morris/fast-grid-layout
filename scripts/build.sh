#!/usr/bin/env bash
set -o errexit
set -o nounset
set -o pipefail
set -x

rm -rf dist

tsc --project tsconfig.dev.json
sass --no-source-map src/fast-grid-layout.scss docs/css/fast-grid-layout.css

tsc --project tsconfig.build.json
sass --no-source-map src/fast-grid-layout.scss dist/fast-grid-layout.css

terser dist/fast-grid-layout.js --compress --mangle toplevel --output dist/fast-grid-layout.min.js
sass --no-source-map --style=compressed src/fast-grid-layout.scss dist/fast-grid-layout.min.css
