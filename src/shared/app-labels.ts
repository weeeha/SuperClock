// Human-readable app names shared by every admin surface (Apps catalog,
// playlist rows). Deliberately NOT derived from the kiosk app registry:
// the registry is populated by side-importing every app module (lazy React
// chunks), which the admin bundle must never pull in. Keys are pinned to
// the registered app ids by src/shared/registry-coherence.test.ts, and the
// Record<KioskAppId, string> type makes a missing entry a compile error.
import type { KioskAppId } from './capabilities';

export const APP_LABELS: Record<KioskAppId, string> = {
  agents: 'Agents',
  breathing: 'Breathing',
  'claude-usage': 'Claude Usage',
  clock: 'Clock',
  weather: 'Weather',
  calendar: 'Calendar',
  fitness: 'Fitness',
  github: 'GitHub',
  habits: 'Habits',
  fireplace: 'Fireplace',
  'photo-frame': 'Photo Frame',
  quote: 'Quote',
  'time-tracking': 'Time Tracking',
  todo: 'Todo',
};

// The admin renders fleet state that may name apps this build doesn't know
// (older admin, newer kiosk) — fall back to the raw id rather than crash.
export function appLabel(id: string): string {
  return (APP_LABELS as Record<string, string>)[id] ?? id;
}
