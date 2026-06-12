#!/usr/bin/env bash
# Push the slow-native source tree to SuperClock-Slow over SSH and build it
# there. Run on the Mac.
#
#   bash slow-native/scripts/deploy-from-mac.sh

set -euo pipefail

HOST="${HOST:-slowclock}"
REMOTE_ROOT="${REMOTE_ROOT:-SuperClock-native}"

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SRC="$ROOT/slow-native"

[[ -d "$SRC" ]] || { echo "error: $SRC not found"; exit 1; }

echo "[deploy] rsync → $HOST:$REMOTE_ROOT/slow-native/"
ssh "$HOST" "mkdir -p $REMOTE_ROOT"
rsync -az --delete \
  --exclude 'build/' \
  --exclude '_build/' \
  "$SRC/" "$HOST:$REMOTE_ROOT/slow-native/"

echo "[deploy] running setup-pi.sh on $HOST"
ssh "$HOST" "REPO_DIR=\$HOME/$REMOTE_ROOT bash \$HOME/$REMOTE_ROOT/slow-native/scripts/setup-pi.sh"
