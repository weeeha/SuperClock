#!/usr/bin/env bash
# Install build dependencies on a fresh Pi OS Trixie image, then build the
# native SuperClock kiosk. Run on the Pi (NOT on the Mac).
#
#   curl ... | bash    # or:
#   ssh slowclock 'bash -s' < setup-pi.sh
#
# Idempotent — re-runs are cheap.

set -euo pipefail

if [[ "$(uname -m)" != "aarch64" ]]; then
  echo "error: this script targets aarch64 (Pi OS Trixie). Got $(uname -m)." >&2
  exit 1
fi

REPO_DIR="${REPO_DIR:-$HOME/SuperClock-native}"
SRC_DIR="${SRC_DIR:-$REPO_DIR/slow-native}"

echo "[setup] installing build deps"
sudo DEBIAN_FRONTEND=noninteractive apt-get update -qq
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y \
  build-essential cmake pkg-config git \
  libdrm-dev \
  libcurl4-openssl-dev libcjson-dev   # weather fetch + JSON parsing

# CMake 3.16+ ships in Trixie; double-check.
cmake_ver=$(cmake --version | head -1 | awk '{print $3}')
echo "[setup] cmake $cmake_ver"

if [[ ! -d "$SRC_DIR" ]]; then
  echo "error: expected source at $SRC_DIR (rsync from the Mac first)." >&2
  echo "       see slow-native/scripts/deploy-from-mac.sh" >&2
  exit 1
fi

# Build.
BUILD_DIR="$REPO_DIR/build"
mkdir -p "$BUILD_DIR"
cd "$BUILD_DIR"
echo "[setup] configuring (first run fetches LVGL — ~30s)"
cmake -DCMAKE_BUILD_TYPE=Release "$SRC_DIR"
echo "[setup] building"
cmake --build . --parallel "$(nproc)"

# Drop the binary next to the WorkingDirectory the systemd unit expects.
cp -v "$BUILD_DIR/superclock_native" "$REPO_DIR/superclock_native"

echo "[setup] done. Binary at: $REPO_DIR/superclock_native"
echo
echo "Next steps:"
echo "  # install + enable the systemd unit"
echo "  sudo cp $SRC_DIR/scripts/superclock-native.service /etc/systemd/system/"
echo "  sudo systemctl daemon-reload"
echo
echo "  # before starting, disable the labwc desktop session (it'll fight"
echo "  # for /dev/dri/card1):"
echo "  sudo raspi-config nonint do_boot_behaviour B1   # console autologin"
echo "  sudo systemctl enable --now superclock-native.service"
echo "  sudo reboot"
