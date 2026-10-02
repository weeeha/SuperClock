import { useRef } from 'react';
import { angleFrom12, bandCircle, degreesToMs, msToDegrees, snapClamp, unwrapDelta } from './dial';

/** The invisible band that sets the duration. Its stroke is the hit area
 *  (pointer-events="stroke"), so only touches that start in the band claim
 *  the drag; the global swipe grammar skips anything marked
 *  data-gesture="claim". Dragging is relative and cumulative, so crossing 12
 *  never jumps and one revolution is the full 60 minutes. */
export default function TimerDial({ durationMs, onChange }: { durationMs: number; onChange: (ms: number) => void }) {
  const drag = useRef<{ lastDeg: number; totalDeg: number } | null>(null);
  const { r, strokeWidth } = bandCircle();

  const angleOf = (e: React.PointerEvent<SVGCircleElement>) => {
    const box = (e.currentTarget.ownerSVGElement ?? e.currentTarget).getBoundingClientRect();
    return angleFrom12(e.clientX, e.clientY, box.left + box.width / 2, box.top + box.height / 2);
  };

  return (
    <svg viewBox="0 0 1000 1000" className="absolute inset-0 h-full w-full" aria-hidden="true">
      <circle
        cx="500"
        cy="500"
        r={r}
        strokeWidth={strokeWidth}
        pointerEvents="stroke"
        data-gesture="claim"
        className="touch-none fill-none stroke-transparent"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture?.(e.pointerId);
          drag.current = { lastDeg: angleOf(e), totalDeg: msToDegrees(durationMs) };
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d) return;
          const deg = angleOf(e);
          d.totalDeg = Math.min(360, Math.max(0, d.totalDeg + unwrapDelta(d.lastDeg, deg)));
          d.lastDeg = deg;
          onChange(snapClamp(degreesToMs(d.totalDeg)));
        }}
        onPointerUp={() => {
          drag.current = null;
        }}
        onPointerCancel={() => {
          drag.current = null;
        }}
      />
    </svg>
  );
}
