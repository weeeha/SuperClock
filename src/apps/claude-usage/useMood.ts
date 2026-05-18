import { useState } from 'react';
import type { MoodGroup } from './sprites';

// Mirrors firmware/src/usage_rate.cpp from Clawdmeter:
// - Track a ring buffer of (timestamp, session %) samples.
// - Compute %/min over the window between oldest and newest samples.
// - Need at least MIN_WINDOW_MS of history before the rate is trusted —
//   otherwise default to idle.
// - Drop the buffer if the session % falls (5h reset rolled over).

const RING_SIZE = 6;
const MIN_WINDOW_MS = 240_000; // 4 min
const RATE_THRESH_NORMAL = 0.10;
const RATE_THRESH_ACTIVE = 0.20;
const RATE_THRESH_HEAVY = 0.33;

interface Sample {
  ms: number;
  pct: number;
}

function moodFromRing(ring: Sample[]): MoodGroup {
  if (ring.length < 2) return 0;
  const oldest = ring[0];
  const newest = ring[ring.length - 1];
  const dt = newest.ms - oldest.ms;
  if (dt < MIN_WINDOW_MS) return 0;
  const dp = Math.max(0, newest.pct - oldest.pct);
  const rate = (dp * 60_000) / dt;
  if (rate < RATE_THRESH_NORMAL) return 0;
  if (rate < RATE_THRESH_ACTIVE) return 1;
  if (rate < RATE_THRESH_HEAVY) return 2;
  return 3;
}

export function useMood(sessionPct: number | null): MoodGroup {
  const [ring, setRing] = useState<Sample[]>([]);
  const [lastPct, setLastPct] = useState<number | null>(null);

  // A new sample arrives whenever sessionPct changes. The mood depends on the
  // *timing* of past samples, so it can't be a pure render-time derivation —
  // but recording the sample is still change-driven, so we use React's
  // sanctioned "adjust state during render" pattern instead of a
  // setState-in-Effect. Mood is then derived purely from the buffer.
  if (sessionPct != null && sessionPct !== lastPct) {
    setLastPct(sessionPct);
    setRing((prev) => {
      const last = prev[prev.length - 1];
      // Session % dropped sharply → 5h window rolled over; discard history.
      const base = last && sessionPct + 5 < last.pct ? [] : prev;
      const next = [...base, { ms: Date.now(), pct: sessionPct }];
      return next.length > RING_SIZE ? next.slice(next.length - RING_SIZE) : next;
    });
  }

  return moodFromRing(ring);
}
