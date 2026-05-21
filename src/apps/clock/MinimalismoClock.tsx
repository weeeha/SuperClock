import { useState, useEffect } from 'react';
import type { AppProps } from '../../core/types';

/**
 * Minimalismo — pure-white face, black hour/minute hands, gold sweeping second.
 * No ticks, no numerals, no center pip. Origin: SuperClock-Slow LVGL prototype,
 * 2026-05-09. Same hand geometry as AnalogClock; the second hand sweeps via
 * 30ms tick + sub-second fraction so there's no CSS transition fighting the
 * minute wrap.
 */
export default function MinimalismoClock({ isActive }: AppProps) {
  const [time, setTime] = useState(() => new Date());

  useEffect(() => {
    if (!isActive) return;
    const id = setInterval(() => setTime(new Date()), 30);
    return () => clearInterval(id);
  }, [isActive]);

  const hours = time.getHours() % 12;
  const minutes = time.getMinutes();
  const seconds = time.getSeconds() + time.getMilliseconds() / 1000;

  const hourDeg = hours * 30 + minutes * 0.5;
  const minuteDeg = minutes * 6 + seconds * 0.1;
  const secondDeg = seconds * 6;

  return (
    <div className="flex h-full w-full items-center justify-center bg-white">
      <svg viewBox="0 0 1000 1000" className="h-full w-full max-h-screen max-w-screen">
        <circle cx="500" cy="500" r="500" fill="#FFFFFF" />

        <line
          x1="500"
          y1="500"
          x2="500"
          y2="220"
          stroke="#000000"
          strokeWidth="28"
          strokeLinecap="round"
          style={{ transform: `rotate(${hourDeg}deg)`, transformOrigin: '500px 500px' }}
        />

        <line
          x1="500"
          y1="500"
          x2="500"
          y2="120"
          stroke="#000000"
          strokeWidth="20"
          strokeLinecap="round"
          style={{ transform: `rotate(${minuteDeg}deg)`, transformOrigin: '500px 500px' }}
        />

        <line
          x1="500"
          y1="580"
          x2="500"
          y2="150"
          stroke="#FFD700"
          strokeWidth="6"
          strokeLinecap="round"
          style={{ transform: `rotate(${secondDeg}deg)`, transformOrigin: '500px 500px' }}
        />
      </svg>
    </div>
  );
}
