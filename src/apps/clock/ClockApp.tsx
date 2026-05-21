import { useState, useCallback } from 'react';
import type { AppProps } from '../../core/types';
import AnalogClock from './AnalogClock';
import MinimalismoClock from './MinimalismoClock';
import ProductivityClock from './ProductivityClock';
import SquareClock from './SquareClock';

/* Minimalismo first — lifted from the SuperClock-Slow LVGL prototype
 * (2026-05-09). Same hand geometry as AnalogClock, no tick marks or
 * center pip — just the sweep. */
const faces = [MinimalismoClock, AnalogClock, ProductivityClock, SquareClock];

/** Clock app with multiple watch faces — swipe internally to switch faces */
export default function ClockApp(props: AppProps) {
  const [faceIndex, setFaceIndex] = useState(0);

  const handleSwipeOut = useCallback(
    (direction: 'left' | 'right') => {
      if (direction === 'left') {
        if (faceIndex < faces.length - 1) {
          setFaceIndex((i) => i + 1);
        } else {
          props.onSwipeOut?.('left');
        }
      } else {
        if (faceIndex > 0) {
          setFaceIndex((i) => i - 1);
        } else {
          props.onSwipeOut?.('right');
        }
      }
    },
    [faceIndex, props],
  );

  const Face = faces[faceIndex];

  return (
    <div className="relative h-full w-full">
      <Face {...props} onSwipeOut={handleSwipeOut} />

      {/* Face indicator dots */}
      <div className="absolute bottom-6 left-0 right-0 flex justify-center gap-2">
        {faces.map((_, i) => (
          <div
            key={i}
            className={`h-2 w-2 rounded-full transition-colors ${
              i === faceIndex ? 'bg-white' : 'bg-white/30'
            }`}
          />
        ))}
      </div>
    </div>
  );
}
