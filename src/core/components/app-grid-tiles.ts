// App face thumbnails from Figma designs — mapped to app IDs.
// Pure data (no React) so src/shared/registry-coherence.test.ts can pin it
// against the app registry: every registered app must be reachable from a
// column slot, and every entry here must be placed. Duplicate ids are
// intentional — some apps repeat with different previews to fill the circle.
export const appFaces: { id: string; src: string }[] = [
  { id: 'calendar',      src: '/66e1444195d1e33bc606b22d835d1fd622557dcb.png' },
  { id: 'clock',          src: '/0c1961af226ba211646b2b33306bc15147b1b2b6.png' },
  { id: 'quote',          src: '/39cdd10bd458b184830ee8dd78d5f01d99bda902.png' },
  { id: 'weather',        src: '/fca3f89707c8636082807a2351c8b645ca702a00.png' },
  { id: 'clock',          src: '/943f75df27e1332321d3108a522e892298894540.png' },
  { id: 'fireplace',      src: '/81f94dfb595df1aee5f553535d4406d7aab01b7d.png' },
  { id: 'photo-frame',    src: '/a748a5a0305756791110c2732c1757e377a9b831.png' },
  { id: 'fitness',        src: '/33bd4aa08e3af76c3ace9a1565cd7275abf34678.png' },
  { id: 'habits',         src: '/cc876a16834c102930f72c63c69d462b84dbc32e.png' },
  { id: 'clock',          src: '/8e5d0338383404692c1d0484623940d0d4399f2d.png' },
  { id: 'clock',          src: '/cee377e32880ba501c02f449690367b8028ab4cf.png' },
  { id: 'time-tracking',  src: '/690ef2a4d2142a144f030f7a4f4bc796609d3518.png' },
  { id: 'github',          src: '/github-thumb.svg' },
  { id: 'claude-usage',    src: '/claude-usage-thumb.svg' },
  { id: 'agents',          src: '/agents-thumb.svg' },
  { id: 'todo',            src: '/todo-thumb.svg' },
  { id: 'breathing',       src: '/breathing-thumb.svg' },
];

// Arrange into columns matching Figma layout (489:30357)
// The Figma design has 7 columns with varying heights
export const columns = [
  [appFaces[0], appFaces[15], appFaces[16]], // Earth/Calendar, Todo, Breathing
  [appFaces[1], appFaces[2]],             // Quote, Space
  [appFaces[3], appFaces[4], appFaces[5]], // Calendar, Productivity, Github
  [appFaces[6], appFaces[7], appFaces[8], appFaces[9]], // Watchface, Abstract, Weather, Space
  [appFaces[10], appFaces[11], appFaces[0]], // Clock, Relax, Gym
  [appFaces[1], appFaces[2]],             // Photo, Habits
  [appFaces[3], appFaces[12], appFaces[13], appFaces[14]], // Magnetic Liquid, GitHub, Claude Usage, Agents
];
