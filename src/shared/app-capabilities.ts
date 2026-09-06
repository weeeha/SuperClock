// What each kiosk app does and needs — structured metadata for the admin, the
// kiosk and any agent reading the repo. Every row is CHECKED against the code
// by app-capabilities.test.ts: `fetches` ⇔ the app directory calls fetch()
// (and carries an honest offline tell), `ticks` ⇔ it owns a timer or rAF loop,
// `multiView` ⇔ it registers the shell's vertical-swipe slot; the hardware
// members must be provided by at least one device (capabilities.ts features).
// A declaration the code contradicts fails `npm test`, so this file cannot
// drift into fiction the way the config schemas once did (decision D4).
//
// Leaf module on purpose: capabilities.ts builds the wire descriptors from
// it, so importing capabilities.ts back here would be a cycle.

import type { AppCapability } from './types';

export type { AppCapability } from './types';

/** The members that map onto device FeatureFlags. */
export const HARDWARE_CAPABILITIES = ['audio', 'mic', 'radar'] as const satisfies readonly AppCapability[];

export const APP_CAPABILITIES: Record<string, readonly AppCapability[]> = {
  // mic: the voice pipeline the app is designed around (a mock mic state today).
  agents: ['ticks', 'multiView', 'mic'],
  // radar: breathing detection reads the A121 through /api/occupancy.
  breathing: ['ticks', 'radar'],
  calendar: ['fetches', 'ticks', 'multiView'],
  'claude-usage': ['fetches', 'ticks', 'multiView'],
  // Face cycling is the multi-view; hands tick through useClockHands in core.
  clock: ['multiView'],
  fireplace: ['ticks'],
  // audio: circuit-runner cues (AudioContext / new Audio).
  fitness: ['ticks', 'multiView', 'audio'],
  github: ['fetches', 'ticks', 'multiView'],
  habits: ['ticks', 'multiView'],
  'photo-frame': ['fetches', 'ticks'],
  quote: ['ticks'],
  // radar: presence-driven tracking.
  'time-tracking': ['fetches', 'ticks', 'multiView', 'radar'],
  todo: ['multiView'],
  weather: ['fetches', 'ticks', 'multiView'],
};
