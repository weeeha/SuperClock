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
