// One icon per app id: the kiosk AppGrid's tile art and the admin's art
// source for non-clock screens (clock screens use face-registry previews
// instead; see src/admin/lib/screen-art.ts). Every path is a hand-drawn
// 200 x 200 SVG in public/ in one style (dark disc, one accent, Inter label
// inside the round mask), pinned to a real file by registry-contract.test.ts
// and to one tile per app by src/core/components/AppGrid.test.tsx.
export const APP_ICONS: Record<string, string> = {
  agents: '/agents-thumb.svg',
  'ai-face': '/avatars/assets/abstract/wheatley.png',
  alarm: '/alarm-thumb.svg',
  breathing: '/breathing-thumb.svg',
  calendar: '/calendar-thumb.svg',
  'claude-usage': '/claude-usage-thumb.svg',
  clock: '/clock-thumb.svg',
  countdown: '/countdown-thumb.svg',
  fireplace: '/fireplace-thumb.svg',
  fitness: '/fitness-thumb.svg',
  github: '/github-thumb.svg',
  habits: '/habits-thumb.svg',
  'photo-frame': '/photo-frame-thumb.svg',
  quote: '/quote-thumb.svg',
  'time-tracking': '/time-tracking-thumb.svg',
  timer: '/timer-thumb.svg',
  todo: '/todo-thumb.svg',
  weather: '/weather-thumb.svg',
};
