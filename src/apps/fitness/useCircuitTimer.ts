// Drives TICK events while the app is the active screen. rAF rather than
// setInterval so the browser throttles it when the tab is hidden, and so
// ticking stops the moment the app is swiped away — background apps must
// not tick (CLAUDE.md), and a kiosk runs for weeks.

import { useEffect, useRef } from 'react';

/** ~10Hz is plenty: the display only shows whole seconds. */
const MIN_TICK_MS = 100;

export function useCircuitTimer(active: boolean, onTick: (now: number) => void): void {
  const cb = useRef(onTick);

  useEffect(() => {
    cb.current = onTick;
  }, [onTick]);

  useEffect(() => {
    if (!active) return;
    let raf = 0;
    let last = 0;
    const loop = (t: number) => {
      if (t - last >= MIN_TICK_MS) {
        last = t;
        cb.current(Date.now());
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [active]);
}
