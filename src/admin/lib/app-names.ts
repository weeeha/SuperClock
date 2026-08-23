// One display name per app id — the admin's single copy of the KIOSK's
// registered metadata names (src/apps/*/index.ts is the source of truth but
// registers lazy React components, so the admin cannot import it). Pinned to
// glass truth by registry-contract.test.ts, which parses the kiosk sources —
// change a kiosk name and the suite tells you to update this map.
// Unknown ids humanize instead of vanishing.
const APP_NAMES: Record<string, string> = {
  agents: 'Agents',
  breathing: 'Breathing',
  calendar: 'Calendar',
  'claude-usage': 'Claude Usage',
  clock: 'Clock',
  fireplace: 'Fireplace',
  fitness: 'Fitness',
  github: 'GitHub',
  habits: 'Habits',
  'photo-frame': 'Photos',
  quote: 'Quote',
  'time-tracking': 'Timer',
  todo: 'Todo',
  weather: 'Weather',
};

export function appDisplayName(appId: string): string {
  return (
    APP_NAMES[appId] ??
    appId
      .split('-')
      .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : part))
      .join(' ')
  );
}
