import type { ComponentType } from 'react';
import MinimalismoClock from './MinimalismoClock';
import AnalogClock from './AnalogClock';
import ProductivityClock from './ProductivityClock';
import SquareClock from './SquareClock';
import FloralClock from './FloralClock';
import ComplicationsLight from './ComplicationsLight';
import ComplicationsDark from './ComplicationsDark';
import WorldClock from './WorldClock';
import FlipClock from './FlipClock';

export type FaceComponent = ComponentType<{ isActive: boolean }>;

// Maps face id (from src/shared/face-registry.ts) to its component.
// Keys MUST match face-registry ids — pinned by registry-coherence.test.ts.
export const FACE_COMPONENTS: Record<string, FaceComponent> = {
  minimalismo: MinimalismoClock,
  analog: AnalogClock,
  productivity: ProductivityClock,
  square: SquareClock,
  floral: FloralClock,
  'complications-light': ComplicationsLight,
  'complications-dark': ComplicationsDark,
  world: WorldClock,
  flip: FlipClock,
};

export const SWIPE_CYCLE_ORDER: FaceComponent[] = [
  MinimalismoClock,
  AnalogClock,
  ProductivityClock,
  SquareClock,
  FloralClock,
  ComplicationsLight,
  ComplicationsDark,
  WorldClock,
  FlipClock,
];
