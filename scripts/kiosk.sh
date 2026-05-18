#!/bin/bash
# SuperClock Chromium kiosk launcher (Raspberry Pi OS Trixie / labwc / Wayland)
#
# Usage:  kiosk.sh [URL]
#   URL defaults to http://localhost:3000
#
# This is launched by labwc from ~/.config/labwc/autostart (installed by
# setup-pi.sh). It is NOT a systemd service: on Wayland, Chromium must be a
# child of the compositor in the user's graphical session, so it runs from
# the labwc autostart rather than a system unit.
#
# It waits for the Express server's /api/health to come up, clears any stale
# Chromium "restore session" crash flags, then execs Chromium.
#
# The flags below are load-bearing — do not drop them:
#   --ozone-platform=wayland     Trixie is Wayland (labwc). Without this
#                                Chromium tries X11 and errors out / white-screens.
#   --password-store=basic
#   --use-mock-keychain          First launch on an account that has never
#                                interactively logged in otherwise pops a
#                                blocking GNOME keyring dialog → white screen.

set -u

URL="${1:-http://localhost:3000}"

# --- Wait for the server -----------------------------------------------------
# Health endpoint served by Express (server/api-mount.ts → GET /api/health).
HEALTH_URL="${URL%/}/api/health"
echo "[kiosk] waiting for $HEALTH_URL ..."
for _ in $(seq 1 60); do
  if curl -fsS --max-time 2 "$HEALTH_URL" >/dev/null 2>&1; then
    echo "[kiosk] server is up."
    break
  fi
  sleep 2
done

# --- Clear Chromium crash flags ---------------------------------------------
# Prevents the "Chrome didn't shut down correctly / restore pages?" infobar
# after an unclean power-off.
CHROMIUM_PROFILE="$HOME/.config/chromium/Default"
if [ -f "$CHROMIUM_PROFILE/Preferences" ]; then
  sed -i 's/"exited_cleanly":false/"exited_cleanly":true/' "$CHROMIUM_PROFILE/Preferences" 2>/dev/null || true
  sed -i 's/"exit_type":"[^"]*"/"exit_type":"Normal"/'   "$CHROMIUM_PROFILE/Preferences" 2>/dev/null || true
fi

# --- Resolve the Chromium binary --------------------------------------------
# Trixie ships /usr/bin/chromium. Fall back to chromium-browser for older images.
if command -v chromium >/dev/null 2>&1; then
  CHROMIUM_BIN="$(command -v chromium)"
elif command -v chromium-browser >/dev/null 2>&1; then
  CHROMIUM_BIN="$(command -v chromium-browser)"
else
  echo "[kiosk] ERROR: no chromium binary found (/usr/bin/chromium expected)." >&2
  exit 1
fi

echo "[kiosk] launching $CHROMIUM_BIN at $URL"

exec "$CHROMIUM_BIN" \
  --kiosk \
  --ozone-platform=wayland \
  --password-store=basic \
  --use-mock-keychain \
  --noerrdialogs \
  --disable-infobars \
  --no-first-run \
  --disable-translate \
  --disable-features=TranslateUI \
  --disable-session-crashed-bubble \
  --check-for-update-interval=31536000 \
  --autoplay-policy=no-user-gesture-required \
  --disable-pinch \
  --overscroll-history-navigation=0 \
  "$URL"
