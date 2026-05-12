import { useState, useEffect, type ComponentType } from 'react';
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

type FaceComponent = ComponentType<{ isActive: boolean }>;

// Maps face id (from src/shared/face-registry.ts) to its component.
// Keys here MUST match face-registry ids.
const FACE_COMPONENTS: Record<string, FaceComponent> = {
  analog: AnalogClock,
  productivity: ProductivityClock,
  square: SquareClock,
  floral: FloralClock,
  'complications-light': ComplicationsLight,
  'complications-dark': ComplicationsDark,
  world: WorldClock,
  flip: FlipClock,
};

const SWIPE_CYCLE_ORDER: FaceComponent[] = [
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

  const configFaceId = typeof props.config?.faceId === 'string' ? props.config.faceId : undefined;
  const configFace = configFaceId ? FACE_COMPONENTS[configFaceId] : undefined;

  useEffect(() => {
    // When a config-driven face is active, the user shouldn't be able to swipe-cycle.
    if (!props.isActive || configFace) {
      setVerticalSwipeCallback(null);
      return;
    }
    setVerticalSwipeCallback((dir) => {
      if (dir === 'down') setFaceIndex((i) => (i + 1) % SWIPE_CYCLE_ORDER.length);
      else setFaceIndex((i) => (i - 1 + SWIPE_CYCLE_ORDER.length) % SWIPE_CYCLE_ORDER.length);
    });
    return () => setVerticalSwipeCallback(null);
  }, [props.isActive, configFace, setVerticalSwipeCallback]);

  const Face = configFace ?? SWIPE_CYCLE_ORDER[faceIndex];

  return (
    <div className="relative h-full w-full">
      <Face isActive={props.isActive} />
    </div>
  );
}
