import { useRef } from 'react';
import { angleFrom12, bandCircle, unwrapDelta } from '../../core/widgets/dial-geometry';

/** The invisible band that turns Alarm's ring dial. Only touches that start in
 *  the band claim the drag (data-gesture="claim"); it reports rotation in
 *  degrees and the screen turns that into 5-minute or 1-hour steps. */
export default function AlarmDial({ onRotate }: { onRotate: (deltaDeg: number) => void }) {
  const last = useRef<number | null>(null);
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
          last.current = angleOf(e);
        }}
        onPointerMove={(e) => {
          if (last.current === null) return;
          const deg = angleOf(e);
          onRotate(unwrapDelta(last.current, deg));
          last.current = deg;
        }}
        onPointerUp={() => {
          last.current = null;
        }}
        onPointerCancel={() => {
          last.current = null;
        }}
      />
    </svg>
  );
}
