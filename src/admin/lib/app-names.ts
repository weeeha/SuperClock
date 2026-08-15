// One display name per app id — consumed by the Apps tab and App Detail so
// the two surfaces can never drift (the v1 pages kept separate maps and did:
// "Photos" vs "Photo Frame"). Unknown ids humanize instead of vanishing.
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
  'photo-frame': 'Photo Frame',
  quote: 'Quote',
  'time-tracking': 'Time Tracking',
  todo: 'To-do',
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
