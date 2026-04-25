#!/bin/bash
# SuperClock Raspberry Pi Setup Script
# Run this once on a fresh Raspberry Pi OS (Bookworm) install
# Usage: sudo bash setup-pi.sh

set -e

echo "=== SuperClock Pi Setup ==="

# Update system
apt-get update && apt-get upgrade -y

# Install required packages
apt-get install -y \
  chromium-browser \
  unclutter \
  xdotool \
  nginx \
  git

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

# Configure nginx to serve the static build
cat > /etc/nginx/sites-available/superclock << 'NEOF'
server {
    listen 8080;
    server_name localhost;
    root /home/pi/SuperClock/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets aggressively
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
NEOF

ln -sf /etc/nginx/sites-available/superclock /etc/nginx/sites-enabled/superclock
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl restart nginx

# Create autostart directory for the pi user
AUTOSTART_DIR="/home/pi/.config/autostart"
mkdir -p "$AUTOSTART_DIR"

# Install the systemd service
cp /home/pi/SuperClock/scripts/superclock.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable superclock.service

echo ""
echo "=== Setup Complete ==="
echo "Next steps:"
echo "  1. Copy the built dist/ folder to /home/pi/SuperClock/dist/"
echo "  2. Run: sudo systemctl start superclock"
echo "  3. Or reboot: sudo reboot"
echo ""
echo "To build on your dev machine:"
echo "  npm run build"
echo "  scp -r dist/ pi@<pi-ip>:~/SuperClock/dist/"
