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
import DepletionClock from './DepletionClock';
import ApertureClock from './ApertureClock';
import DaylightClock from './DaylightClock';
import StrokesClock from './StrokesClock';
import VinylClock from './VinylClock';
import NeonTubeClock from './NeonTubeClock';
import NeonSignClock from './NeonSignClock';
import NeonNixieClock from './NeonNixieClock';
import NeonPlasmaClock from './NeonPlasmaClock';
import NeonHorizonClock from './NeonHorizonClock';
import RallyClock from './RallyClock';

export interface FaceProps {
  isActive: boolean;
  /** Merged (schema defaults ← saved values) face options from the
   *  instance's `config.face` — present only for config-driven faces. */
  faceConfig?: Record<string, unknown>;
}

export type FaceComponent = ComponentType<FaceProps>;

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
  depletion: DepletionClock,
  aperture: ApertureClock,
  daylight: DaylightClock,
  strokes: StrokesClock,
  vinyl: VinylClock,
  'neon-tube': NeonTubeClock,
  'neon-sign': NeonSignClock,
  'neon-nixie': NeonNixieClock,
  'neon-plasma': NeonPlasmaClock,
  'neon-horizon': NeonHorizonClock,
  rally: RallyClock,
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
  DepletionClock,
  ApertureClock,
  DaylightClock,
  StrokesClock,
  VinylClock,
  NeonTubeClock,
  NeonSignClock,
  NeonNixieClock,
  NeonPlasmaClock,
  NeonHorizonClock,
  RallyClock,
];
