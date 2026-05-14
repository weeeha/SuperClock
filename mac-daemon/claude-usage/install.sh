#!/usr/bin/env bash
# Install the claude-usage LaunchAgent on macOS.
# Resolves the user's `node` binary, expands template placeholders in the plist,
# and boots the agent via launchctl.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LABEL="com.superclock.claude-usage"
PLIST_TEMPLATE="$SCRIPT_DIR/${LABEL}.plist"
TARGET_PLIST="$HOME/Library/LaunchAgents/${LABEL}.plist"
LOG_DIR="$HOME/Library/Logs/superclock"
SERVER_SCRIPT="$SCRIPT_DIR/usage-server.mjs"

if ! command -v node >/dev/null 2>&1; then
  echo "error: node not found in PATH" >&2
  exit 1
fi
NODE_BIN="$(command -v node)"

mkdir -p "$LOG_DIR" "$(dirname "$TARGET_PLIST")"

# Materialise the plist with absolute paths.
sed \
  -e "s|/usr/local/bin/node|$NODE_BIN|g" \
  -e "s|__SCRIPT__|$SERVER_SCRIPT|g" \
  -e "s|__LOG_DIR__|$LOG_DIR|g" \
  "$PLIST_TEMPLATE" > "$TARGET_PLIST"

# Reload if already loaded.
launchctl unload "$TARGET_PLIST" 2>/dev/null || true
launchctl load "$TARGET_PLIST"

echo "installed: $TARGET_PLIST"
echo "logs:      $LOG_DIR/"
echo
echo "test it:   curl http://localhost:47823/usage"
