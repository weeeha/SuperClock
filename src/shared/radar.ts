// Wire types for the A121 mmWave radar surface (/api/radar/*).
// Shared between the Express server (which owns the sensor) and the kiosk
// client (presence shade, Breathing app). Keep dependency-free.

export type RadarMode = 'presence' | 'breathing';

export interface BreathingReading {
  // Breaths per minute as reported by the detector.
  rpm: number;
  // 0..1 detector confidence when the firmware reports one.
  confidence?: number;
}

export interface RadarSnapshot {
  // True while a driver (real sensor or mock) is delivering data.
  available: boolean;
  // Where the data comes from — lets UIs label mock data honestly.
  source: 'sensor' | 'mock' | 'none';
  mode: RadarMode;
  // Last explicit presence verdict from the detector. Null until one arrives.
  present: boolean | null;
  // ISO timestamp of the last moment presence was reported true.
  lastPresentAt: string | null;
  // Latest measured distance to the target, millimetres.
  distanceMm: number | null;
  breathing: BreathingReading | null;
  updatedAt: string;
}

export function emptyRadarSnapshot(): RadarSnapshot {
  return {
    available: false,
    source: 'none',
    mode: 'presence',
    present: null,
    lastPresentAt: null,
    distanceMm: null,
    breathing: null,
    updatedAt: new Date(0).toISOString(),
  };
}

// Default minutes of continuous absence before the display blanks
// (client CSS shade and server panel-off both use this).
export const DEFAULT_ABSENT_AFTER_MIN = 10;
