#!/usr/bin/env bash
set -euo pipefail
REV="${1:-HEAD}"
MSG="$(git log -1 --format=%B "$REV")"
if echo "$MSG" | grep -qiE 'cursor|co-authored-by:.*cursor|made-with:[[:space:]]*cursor'; then
  echo "blocked: commit message mentions Cursor"
  exit 1
fi
echo "ok: no Cursor in commit message"
