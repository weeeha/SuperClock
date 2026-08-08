#!/bin/bash
# Deploy SuperClock to a Raspberry Pi.
#
# Usage:  bash scripts/deploy.sh nickv2026@<pi-ip>
#         DEPLOY_ANYWAY=1 bash scripts/deploy.sh nickv2026@<pi-ip>   # branch/dirty override
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
PORT="${PORT:-3000}"

# Pre-flight: know exactly what you are shipping.
#
# Historically THE reason fixes "didn't stick": deploy.sh ships whatever the
# local checkout happens to hold — a stale main, an old branch, uncommitted
# edits. Refuse anything that isn't a clean checkout of origin/main unless
# DEPLOY_ANYWAY=1 says it's deliberate (branch test builds on fastclock are a
# blessed workflow — that's what the override is for).
if [ "${DEPLOY_ANYWAY:-0}" != "1" ]; then
  if [ -n "$(git status --porcelain)" ]; then
    echo "ERROR: working tree is dirty — a deploy must ship a commit, not a snapshot." >&2
    echo "Commit (or stash) first, or force a deliberate test deploy with DEPLOY_ANYWAY=1." >&2
    exit 1
  fi
  git fetch origin main --quiet || echo "WARN: could not fetch origin/main; comparing against the last-known ref." >&2
  HEAD_SHA="$(git rev-parse HEAD)"
  ORIGIN_MAIN_SHA="$(git rev-parse origin/main 2>/dev/null || echo unknown)"
  if [ "$HEAD_SHA" != "$ORIGIN_MAIN_SHA" ]; then
    echo "ERROR: HEAD ($(git rev-parse --short HEAD), $(git rev-parse --abbrev-ref HEAD)) is not origin/main ($(git rev-parse --short origin/main 2>/dev/null || echo unknown))." >&2
    echo "Fleet deploys ship origin/main. For a deliberate branch test build" >&2
    echo "(fastclock is the designated test device), re-run with DEPLOY_ANYWAY=1." >&2
    exit 1
  fi
else
  echo "DEPLOY_ANYWAY=1: shipping $(git rev-parse --short HEAD) ($(git rev-parse --abbrev-ref HEAD))$( [ -n "$(git status --porcelain)" ] && echo ' with UNCOMMITTED changes' )."
fi

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

# Verify the deploy actually took: the new server must come back up AND
# report the commit we just shipped. dist/ mtimes lie (rsync preserves
# them); the build stamp in /api/health does not. A pre-stamp bundle, a
# restart that never happened, or a different process serving the port all
# fail loudly here instead of masquerading as a successful deploy.
EXPECTED_COMMIT="$(git rev-parse HEAD)"
PI_ADDR="${PI_HOST#*@}"
HEALTH_URL="http://$PI_ADDR:$PORT/api/health"
echo "=== Verifying deploy against $HEALTH_URL ==="
DEPLOYED_COMMIT=""
HEALTH_JSON=""
for _ in $(seq 1 30); do
  sleep 2
  HEALTH_JSON="$(curl -fsS --max-time 3 "$HEALTH_URL" 2>/dev/null || true)"
  DEPLOYED_COMMIT="$(printf '%s' "$HEALTH_JSON" | grep -o '"commit":"[0-9a-f]*"' | cut -d'"' -f4 || true)"
  [ -n "$DEPLOYED_COMMIT" ] && break
done
if [ -z "$HEALTH_JSON" ]; then
  echo "ERROR: server did not come back within 60s — check: ssh $PI_HOST 'systemctl status superclock*.service'" >&2
  exit 1
elif [ -z "$DEPLOYED_COMMIT" ]; then
  echo "ERROR: server is up but reports no build stamp — an OLD (pre-stamp) process is still serving." >&2
  echo "The restart signal likely missed it. Inspect: ssh $PI_HOST 'ps aux | grep -i [s]erver.mjs'" >&2
  exit 1
elif [ "$DEPLOYED_COMMIT" != "$EXPECTED_COMMIT" ]; then
  echo "ERROR: deploy did NOT take — device runs $DEPLOYED_COMMIT, expected $EXPECTED_COMMIT." >&2
  exit 1
fi
echo "Verified: $PI_ADDR runs $(git rev-parse --short HEAD) ($(git rev-parse --abbrev-ref HEAD))."

echo ""
echo "=== Deploy complete ==="
echo "First time on this Pi (installs deps + systemd unit + kiosk autostart):"
echo "  ssh $PI_HOST 'sudo bash $REMOTE_DIR/scripts/setup-pi.sh'"
echo ""
echo "If dependencies changed, also refresh them on the Pi:"
echo "  ssh $PI_HOST 'cd $REMOTE_DIR && npm ci --omit=dev'"
