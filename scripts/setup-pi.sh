#!/bin/bash
# SuperClock Raspberry Pi provisioning script
#
# Run ONCE on a fresh Raspberry Pi OS 13 "Trixie" (aarch64) box, as root:
#
#   sudo bash /home/nickv2026/SuperClock/scripts/setup-pi.sh
#
# It is idempotent — safe to re-run after a code update or to repair drift.
#
# Production layout this script targets (VERIFIED):
#   - Express server runs as the systemd unit `superclock-server.service`
#       User                = nickv2026
#       WorkingDirectory    = /home/nickv2026/SuperClock
#       ExecStart           = /usr/bin/npm run start   (node dist/server.mjs; PORT defaults to 3000)
#   - The Chromium kiosk is NOT a systemd service. labwc (the default Wayland
#     compositor on Trixie) runs ~/.config/labwc/autostart on session start;
#     that script (a copy of scripts/kiosk.sh) waits for the server's
#     /api/health and then execs Chromium with the Wayland + keyring flags.
#   - No nginx. Express serves the kiosk SPA and the /api/* surface from one
#     origin on localhost:3000.
#
# Overridable via environment:
#   SERVICE_USER   (default: nickv2026)
#   REPO_DIR       (default: /home/<SERVICE_USER>/SuperClock)
#   PORT           (default: 3000) — written into /etc/default/superclock
#   ADMIN_HOST     (default: false) — set true to bootstrap the admin token

set -euo pipefail

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
SERVICE_USER="${SERVICE_USER:-nickv2026}"
REPO_DIR="${REPO_DIR:-/home/${SERVICE_USER}/SuperClock}"
PORT="${PORT:-3000}"
ADMIN_HOST="${ADMIN_HOST:-false}"

USER_HOME="$(getent passwd "$SERVICE_USER" | cut -d: -f6)"
if [ -z "$USER_HOME" ]; then
  echo "ERROR: user '$SERVICE_USER' does not exist on this system." >&2
  echo "       Create it first, or pass SERVICE_USER=<existing-user>." >&2
  exit 1
fi

if [ "$(id -u)" -ne 0 ]; then
  echo "ERROR: run as root (sudo bash scripts/setup-pi.sh)." >&2
  exit 1
fi

echo "=== SuperClock Pi provisioning ==="
echo "  user        : $SERVICE_USER"
echo "  home        : $USER_HOME"
echo "  repo dir    : $REPO_DIR"
echo "  server port : $PORT"
echo "  admin host  : $ADMIN_HOST"
echo ""

run_as_user() {
  # Run a command as the service user from within the repo dir.
  sudo -u "$SERVICE_USER" -H bash -lc "cd '$REPO_DIR' && $*"
}

# ---------------------------------------------------------------------------
# 1. System packages
#    Trixie ships Chromium at /usr/bin/chromium and labwc as the default
#    Wayland compositor — both preinstalled on Pi OS desktop. We only need
#    Node + npm + a couple of CLI helpers. No nginx, no X11/lightdm stack.
# ---------------------------------------------------------------------------
echo "=== Installing system packages ==="
export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y --no-install-recommends \
  nodejs \
  npm \
  curl \
  ca-certificates \
  git

# Chromium is expected to be preinstalled on Pi OS desktop. Warn (don't fail)
# if it's missing so a Lite image gets a clear pointer.
if [ ! -x /usr/bin/chromium ]; then
  echo "  WARNING: /usr/bin/chromium not found. Installing chromium ..."
  apt-get install -y --no-install-recommends chromium || {
    echo "  WARNING: could not install chromium automatically." >&2
    echo "           The kiosk will not start until Chromium is present at" >&2
    echo "           /usr/bin/chromium (Pi OS *desktop* ships it by default)." >&2
  }
fi

echo "  node : $(node -v 2>/dev/null || echo 'MISSING')"
echo "  npm  : $(npm -v 2>/dev/null || echo 'MISSING')"

# ---------------------------------------------------------------------------
# 2. Repo directory + ownership
#    deploy.sh rsyncs dist/ (client build + bundled server.mjs),
#    package*.json, config/fleet.example.json and scripts/ into $REPO_DIR.
#    Ensure it exists and is owned by the user before we run `npm ci` as
#    that user.
# ---------------------------------------------------------------------------
echo "=== Preparing $REPO_DIR ==="
mkdir -p "$REPO_DIR"
chown -R "$SERVICE_USER:$SERVICE_USER" "$REPO_DIR"

if [ ! -f "$REPO_DIR/package.json" ] || [ ! -f "$REPO_DIR/server.ts" ]; then
  echo ""
  echo "  NOTE: $REPO_DIR does not yet contain the app payload"
  echo "        (package.json / server.ts missing)."
  echo "        Run scripts/deploy.sh from your Mac first, then re-run this"
  echo "        script. systemd units + the kiosk autostart are still being"
  echo "        installed so a subsequent deploy + reboot just works."
  echo ""
  PAYLOAD_PRESENT=false
else
  PAYLOAD_PRESENT=true
fi

# ---------------------------------------------------------------------------
# 3. Production dependencies (only when the payload is present)
#    npm ci --omit=dev is idempotent: it rebuilds node_modules from the
#    lockfile to match exactly.
# ---------------------------------------------------------------------------
if [ "$PAYLOAD_PRESENT" = true ]; then
  echo "=== Installing production dependencies (npm ci --omit=dev) ==="
  if [ -f "$REPO_DIR/package-lock.json" ]; then
    run_as_user "npm ci --omit=dev"
  else
    echo "  WARNING: package-lock.json missing — falling back to 'npm install --omit=dev'." >&2
    run_as_user "npm install --omit=dev"
  fi
fi

# ---------------------------------------------------------------------------
# 4. Server environment file
#    EnvironmentFile=-/etc/default/superclock in the unit. We seed PORT and
#    ADMIN_HOST. The leading '-' in the unit means it's optional, and we never
#    clobber an existing operator-edited file (idempotent).
# ---------------------------------------------------------------------------
echo "=== Writing /etc/default/superclock ==="
if [ ! -f /etc/default/superclock ]; then
  cat > /etc/default/superclock <<EOF
# SuperClock server environment (sourced by superclock-server.service).
# Add server-side app secrets here too (CALENDAR_ICS_URL, GITHUB_TOKEN).
# VITE_* vars are build-time only and belong in .env on the build machine.
PORT=$PORT
ADMIN_HOST=$ADMIN_HOST
EOF
  chmod 644 /etc/default/superclock
  echo "  created."
else
  echo "  already exists — left untouched (edit it by hand to change PORT/ADMIN_HOST)."
fi

# ---------------------------------------------------------------------------
# 5. systemd unit: superclock-server.service
#    Single source of truth lives in scripts/superclock-server.service.
#    We rewrite User/WorkingDirectory/ExecStart so the installed unit always
#    matches this run's SERVICE_USER/REPO_DIR even if the checked-in template
#    drifts. There is exactly ONE systemd unit — the kiosk is handled by
#    labwc autostart (step 6), NOT systemd, because on Wayland Chromium must
#    be a child of the compositor in the user's graphical session.
# ---------------------------------------------------------------------------
echo "=== Installing systemd unit superclock-server.service ==="
UNIT_SRC="$REPO_DIR/scripts/superclock-server.service"
UNIT_DST="/etc/systemd/system/superclock-server.service"

if [ -f "$UNIT_SRC" ]; then
  install -m 644 "$UNIT_SRC" "$UNIT_DST"
else
  # Payload not deployed yet — write a known-good unit so reboot works after
  # the first deploy without re-running this script.
  cat > "$UNIT_DST" <<EOF
[Unit]
Description=SuperClock Express Server
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=__USER__
WorkingDirectory=__REPO__
EnvironmentFile=-/etc/default/superclock
ExecStart=/usr/bin/npm run start
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF
fi

# Pin User/WorkingDirectory/ExecStart to this run's values regardless of the
# template's contents.
sed -i \
  -e "s|^User=.*|User=$SERVICE_USER|" \
  -e "s|^WorkingDirectory=.*|WorkingDirectory=$REPO_DIR|" \
  -e "s|^ExecStart=.*|ExecStart=/usr/bin/npm run start|" \
  -e "s|^User=__USER__|User=$SERVICE_USER|" \
  -e "s|^WorkingDirectory=__REPO__|WorkingDirectory=$REPO_DIR|" \
  "$UNIT_DST"

systemctl daemon-reload
systemctl enable superclock-server.service
echo "  enabled (start with: systemctl start superclock-server.service)."

# ---------------------------------------------------------------------------
# 6. Kiosk via labwc autostart (NOT systemd)
#    labwc runs ~/.config/labwc/autostart on graphical session start. We make
#    that file exec scripts/kiosk.sh, which waits for /api/health then launches
#    Chromium with the mandatory Wayland + keyring flags. We append our line
#    idempotently and never duplicate it.
# ---------------------------------------------------------------------------
echo "=== Configuring labwc kiosk autostart ==="
LABWC_DIR="$USER_HOME/.config/labwc"
AUTOSTART="$LABWC_DIR/autostart"
KIOSK_SCRIPT="$REPO_DIR/scripts/kiosk.sh"
KIOSK_URL="http://localhost:${PORT}"
KIOSK_LINE="\"$KIOSK_SCRIPT\" \"$KIOSK_URL\" &  # superclock-kiosk"

mkdir -p "$LABWC_DIR"

if [ ! -f "$AUTOSTART" ]; then
  cat > "$AUTOSTART" <<EOF
#!/bin/sh
# labwc autostart — generated by SuperClock setup-pi.sh
$KIOSK_LINE
EOF
else
  # Replace any previous superclock-kiosk line, else append. Idempotent.
  # Use a grep-filter rewrite (not sed) so '&' / '|' / '/' in the path or
  # command are treated literally rather than as sed replacement syntax.
  if grep -q '# superclock-kiosk' "$AUTOSTART"; then
    TMP_AUTOSTART="$(mktemp)"
    grep -v '# superclock-kiosk' "$AUTOSTART" > "$TMP_AUTOSTART"
    printf '%s\n' "$KIOSK_LINE" >> "$TMP_AUTOSTART"
    cat "$TMP_AUTOSTART" > "$AUTOSTART"
    rm -f "$TMP_AUTOSTART"
    echo "  updated existing superclock-kiosk line."
  else
    printf '%s\n' "$KIOSK_LINE" >> "$AUTOSTART"
    echo "  appended superclock-kiosk line."
  fi
fi

chmod +x "$AUTOSTART"
if [ -f "$KIOSK_SCRIPT" ]; then
  chmod +x "$KIOSK_SCRIPT"
fi
chown -R "$SERVICE_USER:$SERVICE_USER" "$LABWC_DIR"

# ---------------------------------------------------------------------------
# 7. Admin token bootstrap (admin host only)
#    server/admin-token.ts reads join(process.cwd(), 'config', 'admin.json').
#    The unit's WorkingDirectory is $REPO_DIR, so the token must live at
#    $REPO_DIR/config/admin.json. Only generated when ADMIN_HOST=true and the
#    file does not already exist (idempotent — never rotates silently).
# ---------------------------------------------------------------------------
ADMIN_CONFIG_DIR="$REPO_DIR/config"
if [ "$ADMIN_HOST" = "true" ]; then
  echo "=== Admin token bootstrap ==="
  mkdir -p "$ADMIN_CONFIG_DIR"
  if [ ! -f "$ADMIN_CONFIG_DIR/admin.json" ]; then
    TOKEN="$(openssl rand -hex 32)"
    cat > "$ADMIN_CONFIG_DIR/admin.json" <<EOF
{ "token": "$TOKEN" }
EOF
    chmod 600 "$ADMIN_CONFIG_DIR/admin.json"
    HOSTNAME_FQDN="$(hostname).local"
    echo ""
    echo "  Admin token created. Open this URL ONCE on a device on the LAN:"
    echo "    http://${HOSTNAME_FQDN}:${PORT}/admin/setup?token=${TOKEN}"
    echo ""
  else
    echo "  config/admin.json already exists — left untouched."
  fi
  chown -R "$SERVICE_USER:$SERVICE_USER" "$ADMIN_CONFIG_DIR"
fi

# Final ownership sweep so npm-created / generated files are user-owned.
chown -R "$SERVICE_USER:$SERVICE_USER" "$REPO_DIR"

# ---------------------------------------------------------------------------
# Done
# ---------------------------------------------------------------------------
echo ""
echo "=== Provisioning complete ==="
echo "Next steps:"
if [ "$PAYLOAD_PRESENT" != true ]; then
  echo "  1. From your Mac:   scripts/deploy.sh ${SERVICE_USER}@<pi-ip>"
  echo "  2. Re-run this:     sudo bash $REPO_DIR/scripts/setup-pi.sh"
  echo "  3. Reboot:          sudo reboot"
else
  echo "  1. Start server:    sudo systemctl start superclock-server.service"
  echo "  2. Reboot to launch the kiosk:  sudo reboot"
fi
echo ""
echo "Checks:"
echo "  systemctl status superclock-server.service"
echo "  curl -s http://localhost:${PORT}/api/health"
