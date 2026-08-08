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

# set -e exits immediately on the first failing command, which would skip
# a trailing `rm` and leak whatever /tmp/<id>.aiff was in flight. A single
# EXIT trap (referencing the loop variable, whatever it currently holds)
# catches that regardless of which command in the loop body failed.
aiff=""
trap 'rm -f "$aiff"' EXIT

for entry in "${CLIPS[@]}"; do
  id="${entry%%|*}"
  text="${entry#*|}"
  echo "→ $id"
  aiff="/tmp/${id}.aiff"
  say -v "$VOICE" "$text" -o "$aiff"
  # Mono 48k AAC: small, and Chromium decodes it without extra codecs.
  ffmpeg -y -loglevel error -i "$aiff" -ac 1 -ar 48000 -b:a 64k "$OUT/${id}.m4a"
  # A truncated or silent `say` would otherwise be encoded and committed
  # without the script ever noticing.
  [ -s "$OUT/${id}.m4a" ] || { echo "empty clip: $id" >&2; exit 1; }
  rm -f "$aiff"
done

echo "Done — $(ls -1 "$OUT" | wc -l | tr -d ' ') clips in $OUT"
