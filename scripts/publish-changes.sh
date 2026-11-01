#!/usr/bin/env bash
# Shared tail for agent workflows: stop-switch check, then publish straight to main (when the admin has automatic
# publishing on and every pull-request check passes) or open ONE pull request for review.
# Usage: scripts/publish-changes.sh <job> "<commit message>" <branch-prefix> "<pr title>" <paths...>
# Env: GH_TOKEN, BASE_BRANCH (default main). Exit 0 when nothing to do or published; non-zero if stopped by the admin.
set -u
job="$1"; msg="$2"; prefix="$3"; title="$4"; shift 4
base="${BASE_BRANCH:-main}"
if [ -z "$(git status --porcelain)" ]; then echo "No changes."; exit 0; fi
GITHUB_TOKEN="${GH_TOKEN:-}" node scripts/agent-guard.mjs "$job" || { echo "Stopped by the admin; nothing is published."; exit 1; }
git config user.name "veda-content-bot"; git config user.email "content-bot@users.noreply.github.com"
for p in "$@"; do [ -e "$p" ] && git add -A "$p"; done
git commit -q -m "$msg" || { echo "Nothing to commit."; exit 0; }
checks() { { node scripts/validate-content.mjs && npm run agents:test && npm run admin:test && npx tsc --noEmit && npx next build; } >/tmp/checks.log 2>&1; }
auto=$(node -e "try{console.log(JSON.parse(require('fs').readFileSync('agents/settings.json','utf8')).autoPublish===true?'yes':'no')}catch(e){console.log('no')}")
if [ "$auto" = "yes" ] && [ "$base" = "main" ]; then
  if checks; then
    for i in 1 2 3; do
      if git push origin HEAD:main; then
        gh workflow run deploy.yml --ref main && echo "Published; deploy started."
        exit 0
      fi
      if ! git pull --rebase origin main; then git rebase --abort; echo "Conflict with main."; break; fi
      checks || { tail -40 /tmp/checks.log; break; }
    done
    echo "Could not publish directly; opening a pull request instead."
  else
    tail -40 /tmp/checks.log; echo "A check failed; opening a pull request instead."
  fi
fi
branch="${prefix}$(date +%Y%m%d-%H%M%S)"
git checkout -q -b "$branch" && git push origin "$branch" || exit 1
body=/tmp/pr-body.md; cp agents/reports/latest.md "$body" 2>/dev/null || echo "Agent changes for review." > "$body"
gh pr create --base "$base" --head "$branch" --title "$title ($(date +%F))" --body-file "$body"
