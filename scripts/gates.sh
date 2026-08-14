#!/usr/bin/env bash
# The local mirror of .github/workflows/ci.yml, in ci.yml's order. CI stops at
# the first failure, so one red gate HIDES every gate behind it — a hand-run
# subset that skips a step can report "green" while CI fails. Never hand-write
# a gate list in a message or a doc; run this. Any ci.yml change updates this
# script in the same commit (and vice versa — ci.yml says the same).
#
# One deliberate divergence: CI's `npm ci` is replaced by a node_modules
# presence check — a full reinstall on every local run would make nobody run
# the gates at all. Worktrees start without node_modules; the check says so.

set -u
cd "$(dirname "$0")/.." || exit 1 # repo root; the checkout path contains spaces — quotes matter

if [ ! -d node_modules ]; then
  echo "gates: node_modules missing — run 'npm ci' first (worktrees start without it)."
  exit 1
fi

GATES=(
  "npm run lint"
  "npm run check:tokens"
  "npm test"
  "npm run build"
)

for i in "${!GATES[@]}"; do
  gate="${GATES[$i]}"
  echo ""
  echo "=== gate $((i + 1))/${#GATES[@]}: ${gate}"
  if ! ${gate}; then
    remaining=$((${#GATES[@]} - i - 1))
    echo ""
    echo "gates: FAILED at '${gate}'."
    echo "gates: every gate after this one is UNRUN (${remaining} remaining). Fix and re-run from the top."
    exit 1
  fi
done

echo ""
echo "gates: all ${#GATES[@]} green."
