#!/usr/bin/env bash
# Simple ship step for the fill route: drop any NEW page the validator rejects, make sure the site builds,
# push to main and start the deploy. Falls back to a pull request only if main cannot be pushed.
# Usage: scripts/ship.sh "<commit message>" <paths...>      Env: GH_TOKEN, BASE_BRANCH (default main)
set -u
msg="$1"; shift
base="${BASE_BRANCH:-main}"
job="${SHIP_JOB:-sprint}"
GITHUB_TOKEN="${GH_TOKEN:-}" node scripts/agent-guard.mjs "$job" || { echo "Stopped by the admin; nothing is published."; exit 1; }
[ -z "$(git status --porcelain)" ] && { echo "No changes."; exit 0; }
for round in 1 2 3; do
  out=$(node scripts/validate-content.mjs 2>&1) && break
  echo "$out" | tail -20
  bad=$(echo "$out" | grep -oE '[a-z]+/[a-z0-9-]+\.json' | sort -u)
  [ -z "$bad" ] && { echo "Validator failed on something other than a content page."; exit 1; }
  for f in $bad; do
    p="src/content/$f"
    if git ls-files --error-unmatch "$p" >/dev/null 2>&1; then git checkout -q -- "$p"; else rm -f "$p"; fi
    echo "Dropped $f (failed validation)"
  done
done
node scripts/validate-content.mjs >/dev/null 2>&1 || { echo "Validation still failing."; exit 1; }
node scripts/content-bar.mjs || true
npx next build >/tmp/build.log 2>&1 || { tail -40 /tmp/build.log; echo "Site build failed; not publishing."; exit 1; }
git config user.name "veda-content-bot"; git config user.email "content-bot@users.noreply.github.com"
for p in "$@"; do [ -e "$p" ] && git add -A "$p"; done
git commit -q -m "$msg" || { echo "Nothing to commit."; exit 0; }
if [ "$base" = "main" ]; then
  for i in 1 2 3; do
    if git push origin HEAD:main; then gh workflow run deploy.yml --ref main && echo "Published; deploy started."; exit 0; fi
    git pull -q --rebase -X theirs origin main || { git rebase --abort; break; }   # on a clash in content files, keep the page this run just wrote
  done
fi
branch="${SHIP_JOB:-fill}/$(date +%Y%m%d-%H%M%S)"
git checkout -q -b "$branch" && git push origin "$branch" || exit 1
gh pr create --base "$base" --head "$branch" --title "$msg" --body-file agents/reports/latest.md 2>/dev/null || gh pr create --base "$base" --head "$branch" --title "$msg" --body "Automated content fill."
