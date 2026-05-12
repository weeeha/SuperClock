#!/bin/bash
# SuperClock Raspberry Pi Setup Script
# Run this once on a fresh Raspberry Pi OS (Bookworm) install
# Usage: sudo bash setup-pi.sh
#
# Provisions Node.js + the SuperClock Express server (port 3000) and
# the Chromium kiosk pointed at it. No nginx — Express serves both the
# kiosk SPA and the admin/device APIs from a single origin.

set -e

REPO_DIR="/home/pi/SuperClock"
SERVICE_USER="pi"

echo "=== SuperClock Pi Setup ==="

# Update system
apt-get update && apt-get upgrade -y

# Install required system packages
apt-get install -y \
  chromium-browser \
  unclutter \
  xdotool \
  curl \
  ca-certificates \
  git

# Install Node.js 22 LTS via NodeSource if not already present
if ! command -v node >/dev/null 2>&1; then
  echo "=== Installing Node.js 22 ==="
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi

node -v
npm -v

# Disable screen blanking
mkdir -p /etc/X11/xorg.conf.d
cat > /etc/X11/xorg.conf.d/10-blanking.conf << 'XEOF'
Section "ServerFlags"
    Option "BlankTime" "0"
    Option "StandbyTime" "0"
    Option "SuspendTime" "0"
    Option "OffTime" "0"
EndSection
XEOF

# Disable screensaver via lightdm
if [ -f /etc/lightdm/lightdm.conf ]; then
  sed -i 's/#xserver-command=X/xserver-command=X -s 0 -dpms/' /etc/lightdm/lightdm.conf
fi

# Install systemd units (server + kiosk)
cp "$REPO_DIR/scripts/superclock-server.service" /etc/systemd/system/
cp "$REPO_DIR/scripts/superclock.service" /etc/systemd/system/
systemctl daemon-reload
systemctl enable superclock-server.service
systemctl enable superclock.service

# Generate admin auth token on first run (admin Pi only).
# Set ADMIN_HOST=true in /etc/default/superclock to make this Pi the admin host.
ADMIN_CONFIG_DIR="$REPO_DIR/config"
mkdir -p "$ADMIN_CONFIG_DIR"
if [ ! -f "$ADMIN_CONFIG_DIR/admin.json" ] && [ "${ADMIN_HOST:-false}" = "true" ]; then
  TOKEN="$(openssl rand -hex 32)"
  cat > "$ADMIN_CONFIG_DIR/admin.json" << EOF
{ "token": "$TOKEN" }
EOF
  chown "$SERVICE_USER:$SERVICE_USER" "$ADMIN_CONFIG_DIR/admin.json"
  chmod 600 "$ADMIN_CONFIG_DIR/admin.json"
  HOSTNAME_FQDN="$(hostname).local"
  echo ""
  echo "=== Admin host bootstrap ==="
  echo "  Open this URL ONCE on a phone/laptop on the same network:"
  echo "    http://${HOSTNAME_FQDN}:3000/admin/setup?token=${TOKEN}"
  echo ""
fi

echo ""
echo "=== Setup Complete ==="
echo "Next steps:"
echo "  1. Build on dev machine:    npm run build"
echo "  2. Copy to Pi:              scripts/deploy.sh pi@<pi-ip>"
echo "  3. Start services:          sudo systemctl start superclock-server superclock"
echo "  4. Or reboot:               sudo reboot"
