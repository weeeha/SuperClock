#!/bin/bash
# Deploy SuperClock to Raspberry Pi
# Usage: bash scripts/deploy.sh pi@192.168.1.100
#
# This builds the project locally and deploys to the Pi via SSH.

set -e

PI_HOST="${1:?Usage: deploy.sh pi@<pi-ip>}"
REMOTE_DIR="~/SuperClock"

echo "=== Building SuperClock ==="
npm run build

echo "=== Deploying to $PI_HOST ==="
# Create remote directory structure
ssh "$PI_HOST" "mkdir -p $REMOTE_DIR/scripts $REMOTE_DIR/dist"

# Copy built files
rsync -avz --delete dist/ "$PI_HOST:$REMOTE_DIR/dist/"

# Copy scripts
rsync -avz scripts/ "$PI_HOST:$REMOTE_DIR/scripts/"
ssh "$PI_HOST" "chmod +x $REMOTE_DIR/scripts/*.sh"

echo ""
echo "=== Deploy Complete ==="
echo "If this is the first deploy, run on the Pi:"
echo "  sudo bash ~/SuperClock/scripts/setup-pi.sh"
echo ""
echo "To restart the kiosk:"
echo "  ssh $PI_HOST 'sudo systemctl restart superclock'"
