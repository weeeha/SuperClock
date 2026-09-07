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
 * Rendered geometrically (handPoints, no transform/transition) and swept via
 * useClockHands({ sweep: true }) — structurally can't backsweep or float32-jump.
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

export default function MinimalismoClock({ isActive }: AppProps) {
  const { hourDeg, minuteDeg, secondDeg } = useClockHands(isActive, { sweep: true });

  return (
    <div className="theme-fade flex h-full w-full items-center justify-center bg-(--face-bg)">
      <svg viewBox={`0 0 ${spec.space} ${spec.space}`} className="h-full w-full max-h-screen max-w-screen">
        <circle cx={C} cy={C} r={spec.radius} className="theme-fade fill-(--face-bg)" />
        {/* Hour */}
        <line {...handPoints(hourDeg, spec.hands.hour.tip)} className="theme-fade stroke-(--face-ink)" strokeWidth={spec.hands.hour.width} strokeLinecap="round" />
        {/* Minute */}
        <line {...handPoints(minuteDeg, spec.hands.minute.tip)} className="theme-fade stroke-(--face-ink)" strokeWidth={spec.hands.minute.width} strokeLinecap="round" />
        {/* Second — gold in both themes, sweeps */}
        <line {...handPoints(secondDeg, secondSpec.tip, secondSpec.tail ?? 0)} stroke={SECOND_COLOR} strokeWidth={secondSpec.width} strokeLinecap="round" />
      </svg>
    </div>
  );
}
