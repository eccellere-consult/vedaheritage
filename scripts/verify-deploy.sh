#!/usr/bin/env bash
# Post-deploy check: confirms the LIVE site serves the build that was just uploaded.
# Usage: scripts/verify-deploy.sh <base-url> <expected-sha> [path ...]
# Retries because Hostinger/CDN caches can take a minute to catch up.
set -u
BASE="${1%/}"; SHA="$2"; shift 2
PATHS=("${@:-/ /discover/ /sitemap.xml}")
[ "$#" -eq 0 ] && PATHS=(/ /discover/ /sitemap.xml)

attempt() {
  local live code
  live="$(curl -fsSL --max-time 20 "$BASE/version.txt?cb=$RANDOM$RANDOM" 2>/dev/null | tr -d '[:space:]')" || live=""
  if [ "$live" != "$SHA" ]; then echo "version.txt mismatch: live='${live:-<none>}' expected='$SHA'"; return 1; fi
  for p in "${PATHS[@]}"; do
    code="$(curl -sL -o /dev/null --max-time 20 -w '%{http_code}' "$BASE$p?cb=$RANDOM")"
    if [ "$code" != "200" ]; then echo "$p returned HTTP $code"; return 1; fi
  done
  return 0
}

for i in 1 2 3 4 5 6; do
  if attempt; then echo "✔ live site serves build $SHA ($BASE)"; exit 0; fi
  echo "attempt $i/6 failed; retrying in 20s"; sleep "${VERIFY_SLEEP:-20}"
done
echo "✖ deploy verification failed for $BASE"; exit 1
