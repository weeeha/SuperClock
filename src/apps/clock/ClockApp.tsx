import { useState, useEffect } from 'react';
import type { AppProps } from '../../core/types';
import { useNavigation } from '../../core/navigation';
import AnalogClock from './AnalogClock';
import ProductivityClock from './ProductivityClock';
import SquareClock from './SquareClock';
import FloralClock from './FloralClock';
import ComplicationsLight from './ComplicationsLight';
import ComplicationsDark from './ComplicationsDark';
import WorldClock from './WorldClock';
import FlipClock from './FlipClock';

const faces = [
  AnalogClock,
  ProductivityClock,
  SquareClock,
  FloralClock,
  ComplicationsLight,
  ComplicationsDark,
  WorldClock,
  FlipClock,
];

export default function ClockApp(props: AppProps) {
  const [faceIndex, setFaceIndex] = useState(0);
  const setVerticalSwipeCallback = useNavigation((s) => s.setVerticalSwipeCallback);

  useEffect(() => {
    if (!props.isActive) {
      setVerticalSwipeCallback(null);
      return;
    }
    setVerticalSwipeCallback((dir) => {
      if (dir === 'down') setFaceIndex((i) => (i + 1) % faces.length);
      else setFaceIndex((i) => (i - 1 + faces.length) % faces.length);
    });
    return () => setVerticalSwipeCallback(null);
  }, [props.isActive, setVerticalSwipeCallback]);

  const Face = faces[faceIndex];

  return (
    <div className="relative h-full w-full">
      <Face isActive={props.isActive} />
    </div>
  );
}
