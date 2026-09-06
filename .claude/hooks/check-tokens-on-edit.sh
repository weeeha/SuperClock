#!/usr/bin/env bash
# PostToolUse (Write|Edit) — runs the two edit-time gates after an edit lands
# in a gated zone, so contract violations surface at edit time instead of at
# CI:
#   1. the token gate (scripts/check-tokens.mjs) for the semantic-only zones
#      and faces;
#   2. the rule catalogue (scripts/rulecheck.mjs, blocker-severity rules only)
#      for the edited file under src/apps, src/core or src/admin.
#
# ADVISORY BY DESIGN: always exits 0. A failure here must surface without
# blocking an edit that is often mid-way through a legitimate multi-step
# change; CI, scripts/gates.sh and scripts/lib/rulecheck-tree.test.ts stay the
# enforcing copies of these rules.
#
# stdin is parsed with node, not jq (lesson inherited from the donor repo's
# deny hook): a missing jq exits 127, which the harness treats as a hook
# error, and an error in an advisory hook is silent — node is guaranteed
# present in a repo whose gates all run on node.

set -u
ROOT="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"

file=$(node -e '
  let d = "";
  process.stdin.on("data", (c) => (d += c));
  process.stdin.on("end", () => {
    try {
      const j = JSON.parse(d);
      process.stdout.write(j?.tool_input?.file_path ?? "");
    } catch {
      /* malformed input — advisory hook stays silent */
    }
  });
' 2>/dev/null)

case "$file" in
  *"/src/admin/"*.ts | *"/src/admin/"*.tsx | *"/src/core/"*.ts | *"/src/core/"*.tsx | *"/src/apps/clock/"*.tsx)
    out=$(node "$ROOT/scripts/check-tokens.mjs" 2>&1) || {
      echo "token gate (advisory — CI enforces):"
      echo "$out"
    }
    ;;
esac

# Rule catalogue, blocker rules only, on the edited file. The runner reads
# repo-relative paths from its cwd, so relativize and run from ROOT. Exit 2
# means "could not tell" (no rules/ dir, bad JSON) and stays silent here: an
# advisory hook must not shout about its own plumbing.
case "$file" in
  *"/src/apps/"*.ts | *"/src/apps/"*.tsx | *"/src/apps/"*.css | *"/src/core/"*.ts | *"/src/core/"*.tsx | *"/src/core/"*.css | *"/src/admin/"*.ts | *"/src/admin/"*.tsx | *"/src/admin/"*.css)
    rel="${file#"$ROOT"/}"
    out=$(cd "$ROOT" && node scripts/rulecheck.mjs --files "$rel" --severity blocker 2>&1)
    code=$?
    if [ "$code" -eq 1 ]; then
      echo "rule catalogue (advisory — npm test enforces; rules/superclock.json):"
      echo "$out"
    fi
    ;;
esac

exit 0
