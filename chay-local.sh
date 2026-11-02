#!/bin/sh
cd "$(dirname "$0")" || exit 1
command -v node >/dev/null 2>&1 || { echo "Chưa cài Node.js (https://nodejs.org)"; exit 1; }
exec node scripts/serve.mjs
