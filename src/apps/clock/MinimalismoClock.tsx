import type { AppProps } from '../../core/types';
import { useClockHands } from '../../core/hooks/useClockHands';
import { handPoints } from './handPoints';

/**
 * Minimalismo — pure-white face, black hour/minute hands, gold smoothly-sweeping
 * second hand. No ticks, numerals, or centre dot. Born on the SuperClock-Slow
 * LVGL prototype (2026-05-09): the ticks failed to render and the bare sweeping
 * face was the keeper.
 *
 * Rendered geometrically (handPoints, no transform/transition) and swept via
 * useClockHands({ sweep: true }) — structurally can't backsweep or float32-jump.
 */
export default function MinimalismoClock({ isActive }: AppProps) {
  const { hourDeg, minuteDeg, secondDeg } = useClockHands(isActive, { sweep: true });

  return (
    <div className="flex h-full w-full items-center justify-center bg-white">
      <svg viewBox="0 0 1000 1000" className="h-full w-full max-h-screen max-w-screen">
        <circle cx="500" cy="500" r="500" fill="#FFFFFF" />
        {/* Hour */}
        <line {...handPoints(hourDeg, 280)} stroke="#000000" strokeWidth="28" strokeLinecap="round" />
        {/* Minute */}
        <line {...handPoints(minuteDeg, 380)} stroke="#000000" strokeWidth="20" strokeLinecap="round" />
        {/* Second — gold, sweeps */}
        <line {...handPoints(secondDeg, 350, 80)} stroke="#FFD700" strokeWidth="6" strokeLinecap="round" />
      </svg>
    </div>
  );
}
