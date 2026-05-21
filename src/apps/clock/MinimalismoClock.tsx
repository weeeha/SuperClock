import { useState, useEffect } from 'react';
import type { AppProps } from '../../core/types';

/**
 * Minimalismo — solid white face, black hour/minute hands, gold sweeping
 * second hand. No ticks, no numerals, no center pip.
 *
 * Origin: this design emerged from the native C/LVGL prototype on
 * SuperClock-Slow (Pi Zero 2 W) on 2026-05-09. Nick saw it and said
 * "let's save it as a watchface for all apps" — so it lives here too,
 * matching the LVGL version one-for-one.
 *
 * Layout note: the SVG is explicitly sized to `100vmin × 100vmin` and
 * absolutely centred. Using Tailwind's `h-full w-full` + flex made the
 * convergence point of the hands drift right of centre on Fast/Small
 * (we suspect inline-SVG baseline alignment combined with the viewBox
 * scaling). Explicit sizing + transform-centring is bulletproof and
 * works identically across the 1080×1080 round, 800×800 round, and
 * 800×480 rectangular panels in the fleet.
 *
 * Hand endpoints are computed in viewBox coordinates — no per-line
 * `transform` attribute — matching how the LVGL renderer does it.
 */
export default function MinimalismoClock({ isActive }: AppProps) {
  const [time, setTime] = useState(() => new Date());

  useEffect(() => {
    if (!isActive) return;
    /* 30 ms ≈ 33 Hz — same cadence as the LVGL timer on Slow. */
    const id = setInterval(() => setTime(new Date()), 30);
    return () => clearInterval(id);
  }, [isActive]);

  const ms = time.getMilliseconds();
  const seconds = time.getSeconds() + ms / 1000;
  const minutes = time.getMinutes() + seconds / 60;
  const hours = (time.getHours() % 12) + minutes / 60;

  /* 0° = 12 o'clock. SVG +y is down, so subtract 90° from the clock
   * angle to align with screen coordinates. */
  const angleRad = (deg: number) => (deg - 90) * (Math.PI / 180);

  const C = 500; // viewBox centre
  const hourA  = angleRad(hours   * 30);
  const minA   = angleRad(minutes *  6);
  const secA   = angleRad(seconds *  6);

  const hourEnd     = [C + Math.cos(hourA) * 280, C + Math.sin(hourA) * 280];
  const minEnd      = [C + Math.cos(minA)  * 380, C + Math.sin(minA)  * 380];
  const secBack     = [C - Math.cos(secA)  *  80, C - Math.sin(secA)  *  80];
  const secTip      = [C + Math.cos(secA)  * 350, C + Math.sin(secA)  * 350];

  return (
    <div className="relative h-full w-full overflow-hidden bg-white">
      <svg
        viewBox="0 0 1000 1000"
        preserveAspectRatio="xMidYMid meet"
        className="absolute left-1/2 top-1/2 block -translate-x-1/2 -translate-y-1/2"
        style={{ width: '100vmin', height: '100vmin' }}
      >
        {/* Hour hand */}
        <line
          x1={C}
          y1={C}
          x2={hourEnd[0]}
          y2={hourEnd[1]}
          stroke="black"
          strokeWidth="28"
          strokeLinecap="round"
        />

        {/* Minute hand */}
        <line
          x1={C}
          y1={C}
          x2={minEnd[0]}
          y2={minEnd[1]}
          stroke="black"
          strokeWidth="20"
          strokeLinecap="round"
        />

        {/* Second hand — gold, the one that sweeps */}
        <line
          x1={secBack[0]}
          y1={secBack[1]}
          x2={secTip[0]}
          y2={secTip[1]}
          stroke="#FFD700"
          strokeWidth="6"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}
