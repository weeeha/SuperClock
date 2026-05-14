#!/usr/bin/env bash
set -euo pipefail
LABEL="com.superclock.claude-usage"
TARGET_PLIST="$HOME/Library/LaunchAgents/${LABEL}.plist"
launchctl unload "$TARGET_PLIST" 2>/dev/null || true
rm -f "$TARGET_PLIST"
echo "removed: $TARGET_PLIST"
