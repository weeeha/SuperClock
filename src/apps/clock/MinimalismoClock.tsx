import { useEffect, useState } from 'react';
import type { AppProps } from '../../core/types';
import { useClockHands } from '../../core/hooks/useClockHands';
import { resolveSpecColor, specOf } from '../../shared/part-meta';
import { handPoints } from './handPoints';
import minimalismoMeta from './MinimalismoClock.meta.json';

/**
 * Minimalismo — pure-white face (black at night via --face-bg/--face-ink tokens), gold smoothly-sweeping
 * second hand. No ticks, numerals, or centre dot. Born on the SuperClock-Slow
 * LVGL prototype (2026-05-09): the ticks failed to render and the bare sweeping
 * face was the keeper.
 *
 * Hour and minute hands are rendered geometrically (handPoints, no
 * transform/transition) from a once-per-second tick. The second hand is drawn
 * at angle 0 and swept by the `.face-sweep` CSS keyframe in src/index.css:
 * a 60s linear rotate on the compositor, so the sweep costs no React renders
 * at all. It previously drove a 30fps rAF loop through useClockHands({ sweep:
 * true }), re-rendering the whole face 30 times a second for weeks on a Pi 4.
 *
 * Neither historical second-hand bug is reachable: the angle never leaves a
 * 0-360 loop (no float32 large-angle jump) and an animation restarts at 0
 * rather than interpolating the minute wrap backwards the way a transition
 * would.
 *
 * Every number comes from MinimalismoClock.meta.json; the token colours stay
 * as classes here so the token and liveness gates see them.
 */
const spec = specOf(minimalismoMeta, 'MinimalismoClock.meta.json');
// Checked on the raw spec.hands.second path (not a destructured name) so the
// narrowing survives into MinimalismoClock(): TS resets a narrowed *outer*
// const at a nested-function boundary, but a const declared from an
// already-narrowed expression keeps that type as its own.
if (!spec.hands.second) {
  throw new Error('MinimalismoClock.meta.json spec must declare a second hand');
}
const secondSpec = spec.hands.second;
const C = spec.space / 2;
const SECOND_COLOR = resolveSpecColor(secondSpec.color ?? spec.face.ink, {});

// How often the CSS sweep is re-aligned to the wall clock. The document
// timeline advances on the monotonic clock while the hour and minute hands
// come from Date, so an NTP step moves one and not the other. These kiosks run
// for weeks, so alignment cannot be a one-off at mount.
const REALIGN_MS = 5 * 60_000;

/**
 * The gold second hand: drawn at angle 0, rotated by the `.face-sweep`
 * keyframe.
 *
 * A CSS animation's phase is fixed by `animation-delay` at the moment it
 * starts, and mutating that delay on a running animation shifts it visibly.
 * So the delay is captured once per mount by a lazy state initializer — the
 * same pattern useClockHands uses for its own first `new Date()` — and the
 * parent remounts this under a changed key to re-align. Nothing recomputes it
 * in between, so the running animation is never disturbed.
 */
function SweepHand({ isActive }: { isActive: boolean }) {
  const [delay] = useState(() => -((Date.now() % 60_000) / 1000));
  return (
    <line
      {...handPoints(0, secondSpec.tip, secondSpec.tail ?? 0)}
      stroke={SECOND_COLOR}
      strokeWidth={secondSpec.width}
      strokeLinecap="round"
      className="face-sweep"
      style={{
        transformOrigin: `${C}px ${C}px`,
        animationDelay: `${delay}s`,
        animationPlayState: isActive ? 'running' : 'paused',
      }}
    />
  );
}

export default function MinimalismoClock({ isActive }: AppProps) {
  const { time, hourDeg, minuteDeg } = useClockHands(isActive);

  // Re-alignment rides the hook's existing per-second tick rather than a timer
  // of this face's own: ESLint bans setInterval throughout src/apps/clock
  // precisely so the tick lives in one place.
  const alignEpoch = Math.floor(time.getTime() / REALIGN_MS);

  // A hidden document pauses the animation timeline, and on resume the
  // keyframe continues from where it stopped rather than from the wall clock —
  // so without this the hand would read wrong until the next scheduled
  // re-align. The old rAF loop self-corrected on its next frame because it
  // re-read Date; a compositor animation cannot, so it is re-aligned here.
  const [visEpoch, setVisEpoch] = useState(0);
  useEffect(() => {
    const onVisible = () => {
      if (!document.hidden) setVisEpoch((v) => v + 1);
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  return (
    <div className="theme-fade flex h-full w-full items-center justify-center bg-(--face-bg)">
      <svg viewBox={`0 0 ${spec.space} ${spec.space}`} className="h-full w-full max-h-screen max-w-screen">
        <circle cx={C} cy={C} r={spec.radius} className="theme-fade fill-(--face-bg)" />
        {/* Hour */}
        <line {...handPoints(hourDeg, spec.hands.hour.tip)} className="theme-fade stroke-(--face-ink)" strokeWidth={spec.hands.hour.width} strokeLinecap="round" />
        {/* Minute */}
        <line {...handPoints(minuteDeg, spec.hands.minute.tip)} className="theme-fade stroke-(--face-ink)" strokeWidth={spec.hands.minute.width} strokeLinecap="round" />
        {/* Second — gold in both themes, swept by CSS from angle 0 */}
        <SweepHand key={`${alignEpoch}-${visEpoch}`} isActive={isActive} />
      </svg>
    </div>
  );
}
