#!/usr/bin/env bash
# PostToolUse (Write|Edit) — runs the token gate after an edit lands in a
# gated zone, so contract violations surface at edit time instead of at CI.
#
# ADVISORY BY DESIGN: always exits 0. A failure here must surface without
# blocking an edit that is often mid-way through a legitimate multi-step
# change; CI (and scripts/gates.sh) stay the enforcing copy of this rule.
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

exit 0
