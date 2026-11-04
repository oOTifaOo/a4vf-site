#!/usr/bin/env bash
# Chạy các lô do scripts/upload-list.mjs tạo. Lô nào lỗi thì dừng, nên manifest chỉ được tải khi mọi file đã lên đủ.
set -u

run_one() {
  lftp -u "$FTP_USER,$FTP_PASS" "$FTP_HOST" -e "set cmd:fail-exit true; set ssl:verify-certificate no; set net:max-retries 4; set net:reconnect-interval-base 5; source $1; quit"
}

run_group() {
  local pids=() status=0
  for file in "$@"; do
    [ -e "$file" ] || continue
    run_one "$file" &
    pids+=("$!")
  done
  for pid in "${pids[@]}"; do
    wait "$pid" || status=1
  done
  return "$status"
}

run_one upload/folders.lftp || exit 1
run_group upload/assets-*.lftp || exit 1
run_group upload/html-*.lftp || exit 1
run_one upload/manifest.lftp
