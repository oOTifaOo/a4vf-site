#!/bin/sh
cd "$(dirname "$0")" || exit 1
command -v node >/dev/null 2>&1 || { echo "Chưa cài Node.js (https://nodejs.org)"; exit 1; }
if [ -s sheet-url.txt ]; then SHEET_CSV_URL="$(head -n1 sheet-url.txt | tr -d '\r')"; export SHEET_CSV_URL; fi
node scripts/update.mjs && echo "XONG. Quay lại trình duyệt và nhấn Ctrl+F5."
