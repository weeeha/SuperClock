// One icon per app id — the admin's art source for non-clock screens
// (clock screens use face-registry previews instead; see
// src/admin/lib/screen-art.ts). Paths are the same hashed public/ assets the
// kiosk's AppGrid lays out by hand; AppGrid keeps its own layout list (it
// shows multiple clock tiles), so this map is the one-per-app view, pinned to
// real files by registry-contract.test.ts.
export const APP_ICONS: Record<string, string> = {
  agents: '/agents-thumb.svg',
  calendar: '/66e1444195d1e33bc606b22d835d1fd622557dcb.png',
  'claude-usage': '/claude-usage-thumb.svg',
  clock: '/0c1961af226ba211646b2b33306bc15147b1b2b6.png',
  fireplace: '/81f94dfb595df1aee5f553535d4406d7aab01b7d.png',
  fitness: '/33bd4aa08e3af76c3ace9a1565cd7275abf34678.png',
  github: '/github-thumb.svg',
  habits: '/cc876a16834c102930f72c63c69d462b84dbc32e.png',
  'photo-frame': '/a748a5a0305756791110c2732c1757e377a9b831.png',
  quote: '/39cdd10bd458b184830ee8dd78d5f01d99bda902.png',
  'time-tracking': '/690ef2a4d2142a144f030f7a4f4bc796609d3518.png',
  todo: '/todo-thumb.svg',
  weather: '/fca3f89707c8636082807a2351c8b645ca702a00.png',
  // breathing has no grid tile art yet — consumers fall back to a label.
};
