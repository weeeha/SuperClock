#!/bin/bash
# Deploy SuperClock to a Raspberry Pi.
#
# Usage:  bash scripts/deploy.sh nickv2026@<pi-ip>
#
# Builds the app on this machine and rsyncs the runtime payload to the Pi.
# The Express server runs on the Pi via `npm run start` (tsx server.ts), so
# the payload must include server.ts + server/ + package manifests, not just
# dist/. Production node_modules are installed ON the Pi by setup-pi.sh
# (`npm ci --omit=dev`).

set -euo pipefail

PI_HOST="${1:?Usage: deploy.sh <user>@<pi-ip>  (e.g. nickv2026@192.168.1.100)}"
REMOTE_DIR="${REMOTE_DIR:-~/SuperClock}"

echo "=== Building SuperClock ==="
npm run build

echo "=== Deploying to $PI_HOST:$REMOTE_DIR ==="
ssh "$PI_HOST" "mkdir -p $REMOTE_DIR/scripts $REMOTE_DIR/dist $REMOTE_DIR/server $REMOTE_DIR/src/shared"

# Built client bundle.
rsync -avz --delete dist/ "$PI_HOST:$REMOTE_DIR/dist/"

# Server source (run via tsx on the Pi).
rsync -avz --delete server/ "$PI_HOST:$REMOTE_DIR/server/"

# Shared modules the server imports at runtime (tsx resolves ../src/shared/*).
rsync -avz --delete src/shared/ "$PI_HOST:$REMOTE_DIR/src/shared/"

# Top-level runtime files needed by `npm run start` / `npm ci`.
rsync -avz \
  server.ts \
  package.json \
  package-lock.json \
  tsconfig.json \
  tsconfig.node.json \
  "$PI_HOST:$REMOTE_DIR/"

# Provisioning + kiosk scripts.
rsync -avz scripts/ "$PI_HOST:$REMOTE_DIR/scripts/"
ssh "$PI_HOST" "chmod +x $REMOTE_DIR/scripts/*.sh"

# Restart the server so new code (and any pending fleet migration) takes
# effect immediately — otherwise the old process keeps serving the new dist/
# and kiosks that reload on the 6h Chromium cycle would run new JS against
# stale, un-migrated config. The [t] bracket trick stops pkill matching this
# ssh command itself; systemd's Restart= policy brings the service back up.
ssh "$PI_HOST" "pkill -f '[t]sx server.ts' || true"
echo "Server restart signal sent (systemd will bring it back)."

echo ""
echo "=== Deploy complete ==="
echo "First time on this Pi (installs deps + systemd unit + kiosk autostart):"
echo "  ssh $PI_HOST 'sudo bash $REMOTE_DIR/scripts/setup-pi.sh'"
echo ""
echo "If dependencies changed, also refresh them on the Pi:"
echo "  ssh $PI_HOST 'cd $REMOTE_DIR && npm ci --omit=dev'"
