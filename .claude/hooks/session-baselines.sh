#!/usr/bin/env bash
# SessionStart baseline — prints the live numbers a session needs so no doc
# has to be a hand-maintained dashboard, and surfaces the two traps this repo
# has actually paid for:
#   1. Local main lagging origin/main while deploy.sh ships from LOCAL — the
#      recurring "my fix didn't stick" failure.
#   2. A fresh worktree without node_modules (npm ci needed before anything).
# Informational only: SessionStart cannot block, and every step is best-effort.
# Bounded by the hook timeout in .claude/settings.json — a hung fetch gets
# killed by the harness, never by us hanging the session.

set -u
ROOT="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
cd "$ROOT" 2>/dev/null || exit 0 # path contains spaces — quotes matter

branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo '?')
head=$(git rev-parse --short HEAD 2>/dev/null || echo '?')
echo "baseline: ${branch} @ ${head}"

# Linked worktree? (.git is a file, not a directory)
if [ -f .git ]; then
  echo "baseline: this is a WORKTREE — main checkout state differs; npm ci here if node_modules is missing"
fi
if [ ! -d node_modules ]; then
  echo "baseline: node_modules MISSING — run 'npm ci' before tests/build (fresh worktrees start empty)"
fi

# Drift check for the deploy trap. Fetch is best-effort (offline is fine);
# the numbers still mean something against the last-fetched origin/main.
fetched="fresh"
git fetch --quiet --no-tags origin main 2>/dev/null || fetched="stale (fetch failed — numbers are as of last fetch)"
behind=$(git rev-list --count main..origin/main 2>/dev/null || echo '?')
ahead=$(git rev-list --count origin/main..main 2>/dev/null || echo '?')
if [ "$behind" != "?" ] && [ "$behind" -gt 0 ] 2>/dev/null; then
  echo "baseline: local main is ${behind} commit(s) BEHIND origin/main [${fetched}] — deploy.sh ships LOCAL state; pull main before any deploy"
elif [ "$behind" = "0" ]; then
  echo "baseline: local main is in sync with origin/main [${fetched}]"
fi
if [ "$ahead" != "?" ] && [ "$ahead" -gt 0 ] 2>/dev/null; then
  echo "baseline: local main is ${ahead} commit(s) ahead of origin/main (unpushed main commits)"
fi

exit 0
