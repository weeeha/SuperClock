import { useEffect, useRef, useState } from 'react';
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

export function useMood(sessionPct: number | null): MoodGroup {
  const ring = useRef<Sample[]>([]);
  const [mood, setMood] = useState<MoodGroup>(0);

  useEffect(() => {
    if (sessionPct == null) return;

    const now = Date.now();
    const last = ring.current[ring.current.length - 1];
    if (last && sessionPct + 5 < last.pct) {
      // Session reset rolled over — discard history.
      ring.current = [];
    }
    ring.current.push({ ms: now, pct: sessionPct });
    if (ring.current.length > RING_SIZE) ring.current.shift();

    if (ring.current.length < 2) {
      setMood(0);
      return;
    }
    const oldest = ring.current[0];
    const newest = ring.current[ring.current.length - 1];
    const dt = newest.ms - oldest.ms;
    if (dt < MIN_WINDOW_MS) {
      setMood(0);
      return;
    }
    const dp = Math.max(0, newest.pct - oldest.pct);
    const rate = (dp * 60_000) / dt;
    if (rate < RATE_THRESH_NORMAL) setMood(0);
    else if (rate < RATE_THRESH_ACTIVE) setMood(1);
    else if (rate < RATE_THRESH_HEAVY) setMood(2);
    else setMood(3);
  }, [sessionPct]);

  return mood;
}
