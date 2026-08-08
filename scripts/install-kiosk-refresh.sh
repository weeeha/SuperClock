#!/bin/bash
# Install the periodic chromium refresh on a SuperClock kiosk Pi.
#
# Long-running Chromium kiosks on labwc+Wayland develop a black-screen
# renderer hang after ~2-3 days of uptime — chromium and its renderer
# stay alive but compose a black surface. This script appends a 6-hour
# SIGTERM loop to ~/.config/labwc/autostart so the kiosk launcher loop
# already present there respawns chromium periodically with a fresh
# GPU/renderer state.
#
# Idempotent: re-running is safe. A timestamped backup of the original
# autostart is saved alongside the first time the block is added.
#
# Run as the kiosk user (NOT root) on each chromium Pi:
#   bash ~/SuperClock/scripts/install-kiosk-refresh.sh
#
# Not needed on slow (Pi Zero 2 W) — that device runs the native LVGL
# binary, not chromium.

set -e

AUTOSTART="$HOME/.config/labwc/autostart"
SENTINEL='SuperClock periodic chromium refresh'
LOOP_BODY='while true; do sleep 21600; pkill -TERM chromium; done'

if [ ! -f "$AUTOSTART" ]; then
  echo "ERROR: $AUTOSTART not found — is this a labwc kiosk Pi?" >&2
  exit 1
fi

if grep -q "$SENTINEL" "$AUTOSTART"; then
  echo "Refresh block already present in $AUTOSTART — skipping append."
else
  cp "$AUTOSTART" "$AUTOSTART.bak.$(date +%Y%m%d-%H%M%S)"
  cat >> "$AUTOSTART" <<'EOF'

# === SuperClock periodic chromium refresh ===
# Chromium renderer paints black after ~2-3 days uptime on labwc+Wayland.
# Send SIGTERM every 6h so the kiosk-launcher loop above respawns a fresh
# chromium with a clean GPU/renderer state.
(
  while true; do
    sleep 21600
    pkill -TERM chromium
  done
) &
EOF
  echo "Appended refresh block to $AUTOSTART (backup saved alongside)."
fi

# Start the loop now so we don't have to wait for the next labwc startup.
if pgrep -fx "sh -c $LOOP_BODY" >/dev/null; then
  echo "Refresh loop already running in this session."
else
  setsid sh -c "$LOOP_BODY" </dev/null >/dev/null 2>&1 &
  disown 2>/dev/null || true
  sleep 1
  if pgrep -fx "sh -c $LOOP_BODY" >/dev/null; then
    echo "Started refresh loop for current session."
  else
    echo "WARNING: failed to start refresh loop — it will activate on next labwc startup." >&2
  fi
fi
