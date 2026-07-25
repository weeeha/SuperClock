#!/usr/bin/env bash
# Generate the fitness app's voice clips offline.
#
# Run on macOS (uses `say`); output is committed so the Pi never needs a TTS
# engine and the clips sound the same on every device. Re-run only when the
# exercise list changes.
#
#   ./scripts/gen-voice.sh
set -euo pipefail

VOICE="${VOICE:-Samantha}"
OUT="public/fitness/voice"
mkdir -p "$OUT"

# id|spoken text — ids must match src/apps/fitness/exercises.ts
CLIPS=(
  "push-ups|Push ups"
  "squats|Squats"
  "crunches|Crunches"
  "bench-dips|Bench dips"
  "lunges|Lunges"
  "plank|Plank"
  "shoulder-taps|Shoulder taps"
  "jumping-jacks|Jumping jacks"
  "mountain-climbers|Mountain climbers"
  "push-up-rotation|Push up and rotation"
  "high-knees|High knees"
  "side-plank|Side plank"
)

command -v ffmpeg >/dev/null || { echo "ffmpeg not found" >&2; exit 1; }
command -v say >/dev/null    || { echo "say not found (macOS only)" >&2; exit 1; }

for entry in "${CLIPS[@]}"; do
  id="${entry%%|*}"
  text="${entry#*|}"
  echo "→ $id"
  say -v "$VOICE" "$text" -o "/tmp/${id}.aiff"
  # Mono 48k AAC: small, and Chromium decodes it without extra codecs.
  ffmpeg -y -loglevel error -i "/tmp/${id}.aiff" -ac 1 -ar 48000 -b:a 64k "$OUT/${id}.m4a"
  rm -f "/tmp/${id}.aiff"
done

echo "Done — $(ls -1 "$OUT" | wc -l | tr -d ' ') clips in $OUT"
