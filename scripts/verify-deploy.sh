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

diagnose() {
  echo; echo "=== Diagnostics (what the live site returns right now) ==="
  local hosts=("$BASE")
  case "$BASE" in https://www.*) hosts+=("https://${BASE#https://www.}");; esac
  for host in "${hosts[@]}"; do
    echo "--- $host"
    curl -sSIL --max-time 20 "$host/" 2>&1 | grep -iE '^(HTTP|location|server|content-type)' | head -8
    curl -sS -o /dev/null --max-time 20 -w "version.txt -> HTTP %{http_code}\n" "$host/version.txt" 2>&1
  done
  echo
  echo "Hints:"
  echo " - 404 on every page with Hostinger's default 'This Page Does Not Exist' = hPanel Git has not pulled the"
  echo "   deploy branch into this domain's folder. Check hPanel > Advanced > Git (branch deploy, install path) and"
  echo "   the GitHub webhook (docs/DEPLOYMENT.md)."
  echo " - Works on the non-www host but not www = add the www record or set repo variable SITE_URL to the working host."
  echo " - Redirect loop = check HTTPS/www rules in .htaccess and hPanel SSL settings."
}

ATTEMPTS="${VERIFY_ATTEMPTS:-6}"
for i in $(seq 1 "$ATTEMPTS"); do
  if attempt; then echo "✔ live site serves build $SHA ($BASE)"; exit 0; fi
  echo "attempt $i/$ATTEMPTS failed; retrying in ${VERIFY_SLEEP:-20}s"; sleep "${VERIFY_SLEEP:-20}"
done
diagnose
echo "✖ deploy verification failed for $BASE"; exit 1
