import { useState, useCallback } from 'react';
import type { AppProps } from '../../core/types';
import AnalogClock from './AnalogClock';
import ProductivityClock from './ProductivityClock';
import SquareClock from './SquareClock';

const faces = [AnalogClock, ProductivityClock, SquareClock];

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
    </div>
  );
}
