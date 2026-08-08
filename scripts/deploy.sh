#!/bin/bash
# Deploy SuperClock to a Raspberry Pi.
#
# Usage:  bash scripts/deploy.sh nickv2026@<pi-ip>
#
# Builds the app on this machine and rsyncs the runtime payload to the Pi.
# The server ships as a single esbuild bundle (dist/server.mjs) with the
# client build, so the payload is just dist/ + package manifests + scripts/ —
# there is no hand-maintained list of server source dirs to forget (the
# src/shared outage class is gone by construction). npm packages stay
# external; production node_modules are installed ON the Pi by setup-pi.sh
# (`npm ci --omit=dev`).

set -euo pipefail

PI_HOST="${1:?Usage: deploy.sh <user>@<pi-ip>  (e.g. nickv2026@192.168.1.100)}"
REMOTE_DIR="${REMOTE_DIR:-~/SuperClock}"

echo "=== Building SuperClock (client + server bundle) ==="
npm run build

echo "=== Deploying to $PI_HOST:$REMOTE_DIR ==="
ssh "$PI_HOST" "mkdir -p $REMOTE_DIR/scripts $REMOTE_DIR/dist $REMOTE_DIR/config"

# Pre-flight: refuse to sync onto a full card.
#
# `rsync --delete` removes the old files BEFORE it discovers it cannot write
# the new ones, so a full disk doesn't fail cleanly — it leaves dist/ half
# emptied and the kiosk serving a broken page. This happened on 2026-07-25
# when Chromium's BrowserMetrics directory had grown to 19GB and filled a
# 29GB card; the deploy deleted the app bundle and could not replace it.
#
# Needing 3x the payload is deliberate slack: rsync writes to temp files
# alongside the originals before renaming, so the peak is roughly double,
# and a card with only that much left is about to cause this again anyway.
PAYLOAD_KB="$(du -sk dist | cut -f1)"
NEED_KB=$(( PAYLOAD_KB * 3 ))
AVAIL_KB="$(ssh "$PI_HOST" "df -Pk $REMOTE_DIR | tail -1 | awk '{print \$4}'")"
if [ "$AVAIL_KB" -lt "$NEED_KB" ]; then
  echo "ERROR: not enough free space on $PI_HOST" >&2
  echo "  payload:   $(( PAYLOAD_KB / 1024 )) MB" >&2
  echo "  available: $(( AVAIL_KB / 1024 )) MB" >&2
  echo "  required:  $(( NEED_KB / 1024 )) MB (3x payload)" >&2
  echo >&2
  echo "Nothing was changed on the device. Free space first, then re-run." >&2
  echo "Most likely culprit on a long-running kiosk:" >&2
  echo "  ssh $PI_HOST 'du -sh ~/.config/chromium/BrowserMetrics'" >&2
  echo "  ssh $PI_HOST 'find ~/.config/chromium/BrowserMetrics -type f -delete'" >&2
  exit 1
fi
echo "Free space OK: $(( AVAIL_KB / 1024 )) MB available, $(( NEED_KB / 1024 )) MB required."

# Built client bundle + bundled server (dist/server.mjs).
rsync -avz --delete dist/ "$PI_HOST:$REMOTE_DIR/dist/"

# Package manifests (npm ci + `npm run start`).
rsync -avz package.json package-lock.json "$PI_HOST:$REMOTE_DIR/"

# Fleet defaults template. config/ itself is deliberately NOT synced —
# fleet.json / admin.json are device-local state that must survive deploys.
rsync -avz config/fleet.example.json "$PI_HOST:$REMOTE_DIR/config/"

# Provisioning + kiosk scripts.
rsync -avz scripts/ "$PI_HOST:$REMOTE_DIR/scripts/"
ssh "$PI_HOST" "chmod +x $REMOTE_DIR/scripts/*.sh"

# Remove the pre-bundle server-source payload if this Pi still has it
# (server.ts / server/ / src/ / tsconfigs are no longer shipped or used).
ssh "$PI_HOST" "cd $REMOTE_DIR && rm -rf server.ts server src tsconfig.json tsconfig.node.json tsconfig.app.json"

# Restart the server so new code (and any pending fleet migration) takes
# effect immediately — otherwise the old process keeps serving the new dist/
# and kiosks that reload on the 6h Chromium cycle would run new JS against
# stale, un-migrated config. The [bracket] trick stops pkill matching this
# ssh command itself; systemd's Restart= policy brings the service back up.
# Both patterns covered: the new bundle and a still-running pre-bundle tsx.
ssh "$PI_HOST" "pkill -f '[d]ist/server.mjs' || pkill -f '[t]sx server.ts' || true"
echo "Server restart signal sent (systemd will bring it back)."

echo ""
echo "=== Deploy complete ==="
echo "First time on this Pi (installs deps + systemd unit + kiosk autostart):"
echo "  ssh $PI_HOST 'sudo bash $REMOTE_DIR/scripts/setup-pi.sh'"
echo ""
echo "If dependencies changed, also refresh them on the Pi:"
echo "  ssh $PI_HOST 'cd $REMOTE_DIR && npm ci --omit=dev'"
