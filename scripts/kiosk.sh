#!/bin/bash
# SuperClock Kiosk Launcher for Raspberry Pi
# Usage: bash kiosk.sh http://192.168.1.50:3000
#
# Run the SuperClock server on any machine, then run this on the Pi
# to open it fullscreen in Chromium.

URL="${1:?Usage: kiosk.sh http://<server-ip>:3000}"

export DISPLAY=:0

# Disable screen blanking
xset s off 2>/dev/null
xset -dpms 2>/dev/null
xset s noblank 2>/dev/null

# Hide cursor after 3 seconds of inactivity
unclutter -idle 3 -root 2>/dev/null &

# Clear Chromium crash flags (prevents "restore session" popup)
CHROMIUM_DIR="$HOME/.config/chromium/Default"
if [ -f "$CHROMIUM_DIR/Preferences" ]; then
  sed -i 's/"exited_cleanly":false/"exited_cleanly":true/' "$CHROMIUM_DIR/Preferences" 2>/dev/null
  sed -i 's/"exit_type":"Crashed"/"exit_type":"Normal"/' "$CHROMIUM_DIR/Preferences" 2>/dev/null
fi

echo "Opening SuperClock at $URL"

exec chromium-browser \
  --kiosk \
  --noerrdialogs \
  --disable-infobars \
  --disable-translate \
  --no-first-run \
  --disable-features=TranslateUI \
  --check-for-update-interval=31536000 \
  --disable-session-crashed-bubble \
  --autoplay-policy=no-user-gesture-required \
  --start-fullscreen \
  --disable-pinch \
  --overscroll-history-navigation=0 \
  "$URL"
