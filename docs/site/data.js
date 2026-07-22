// Per-app documentation content. Every claim here was read out of the
// component source, the registries, or the captured screenshots — not inferred.

export default [
  {
    id: 'clock',
    name: 'Clock',
    category: 'utility',
    status: { label: 'Shipped', tone: 'ok' },
    tagline: 'A face-cycling shell hosting nine swappable watch faces.',
    shot: 'clock.png',
    shotNote: 'Minimalismo, the default face — also the only face implemented natively in LVGL C for the Slow Pi.',
    description: [
      'Clock is the most developed surface in the kiosk and the only app whose metadata carries a <code>faces</code> array. It renders exactly one face at a time and owns no visual chrome of its own — everything you see belongs to the face component.',
      'It operates in two mutually exclusive modes. Unconfigured, it registers a vertical-swipe callback and cycles through <code>SWIPE_CYCLE_ORDER</code>. When the admin pins a <code>faceId</code>, the callback is deliberately set to null — a configured device must not drift off its face because someone brushed the glass.',
    ],
    data: [
      ['Config', '<code>faceId</code> + <code>face</code> options from device config'],
      ['Schema', 'Face-driven — resolves <code>face.&lt;id&gt;</code>, not <code>app.clock</code>'],
      ['Ticking', '<code>useClockHands</code> — the single source of hand angles'],
    ],
    sitemap: {
      label: 'Clock', sub: 'app shell',
      children: [
        { label: 'Minimalismo', sub: 'classic · no schema' },
        { label: 'Analog', sub: 'classic · face.analog' },
        { label: 'Productivity', sub: 'data-rich' },
        { label: 'Square', sub: 'modern' },
        { label: 'Floral', sub: 'artistic' },
        { label: 'Complications Light', sub: 'data-rich' },
        { label: 'Complications Dark', sub: '4 slots declared' },
        { label: 'World Clock', sub: 'utility' },
        { label: 'Flip', sub: 'classic' },
      ],
    },
    flows: [
      {
        title: 'Face cycling (unconfigured device)',
        steps: [
          { label: 'App becomes active', sub: 'isActive true' },
          { label: 'Register callback', sub: 'setVerticalSwipeCallback' },
          { label: 'User swipes ↕', sub: 'root gesture handler' },
          { label: 'Advance index', sub: 'mod cycle length' },
          { label: 'Render face', sub: 'SWIPE_CYCLE_ORDER' },
        ],
      },
      {
        title: 'Config-pinned face (admin has chosen one)',
        steps: [
          { label: 'Config arrives', sub: '5s poll' },
          { label: 'Look up face', sub: 'FACE_COMPONENTS[id]' },
          { label: 'Merge options', sub: 'defaults ← saved' },
          { label: 'Render pinned', sub: 'cycling disabled' },
        ],
      },
    ],
    tasks: [
      { t: 'No face can host a complication', d: 'Eight of the nine faces declare <code>slots: []</code>. Only Complications Dark declares any, and those are demo slots wired to nothing.', tone: 'risk' },
      { t: 'Minimalismo has no config schema', d: 'It is the default face and the one dual-implemented in C, yet it is the only face the admin cannot configure at all.', tone: 'warn' },
      { t: 'React ↔ LVGL parity is manual', d: 'Any change to Minimalismo geometry, palette, or night behaviour needs a mirrored edit in <code>slow-native/src/clock_face.c</code>. Nothing fails if it is forgotten.', tone: 'warn' },
      { t: 'Faces are React, not data', d: 'Every new face is a pull request and a deploy. The stated direction is JSON face specs on top of engines.', tone: 'info' },
    ],
    files: ['src/apps/clock/ClockApp.tsx', 'src/apps/clock/face-components.ts', 'src/shared/face-registry.ts', 'src/core/hooks/useClockHands.ts'],
  },

  {
    id: 'weather',
    name: 'Weather',
    category: 'utility',
    status: { label: 'Shipped', tone: 'ok' },
    tagline: 'Current conditions and a three-day forecast, with an honest offline tell.',
    shot: 'weather.png',
    shotNote: 'Captured with no location configured — note the small “offline” marker under the date, exactly as the honest-offline rule requires.',
    description: [
      'A static composition: clock and date across the top, current temperature with a condition glyph and a high/low pair, then a three-day strip along the bottom. It reads Open-Meteo, which needs no API key — only a latitude and longitude.',
      'It is one of the two reference implementations for the project rule that a fetching app must show an explicit offline tell rather than quietly presenting stale numbers as live.',
    ],
    data: [
      ['Source', 'Open-Meteo — client-side fetch, no key'],
      ['Schema', '<code>app.weather</code> — location, units, timezone'],
      ['Offline', 'Explicit <code>offline</code> label retained on failure'],
    ],
    sitemap: {
      label: 'Weather', sub: 'static composition',
      children: [
        { label: 'Header', sub: 'time · date · status' },
        { label: 'Current', sub: 'temp · icon · hi/lo' },
        { label: 'Forecast', sub: '3-day strip' },
      ],
    },
    flows: [
      {
        title: 'Fetch and render',
        steps: [
          { label: 'Become active', sub: 'isActive true' },
          { label: 'Fetch Open-Meteo', sub: 'lat / lon from config' },
          { label: 'Parse', sub: 'current + daily' },
          { label: 'Render', sub: 'or mark offline' },
        ],
      },
    ],
    tasks: [
      { t: 'Hourly radial view is designed, not built', d: 'The architecture doc lists weather as a four-view app and names an hourly radial plot. Only the current view exists.', tone: 'info' },
      { t: 'Rolls its own fetch and interval', d: 'One of four apps that would collapse onto a shared <code>useCachedFetch</code> hook, which does not exist yet.', tone: 'warn' },
    ],
    files: ['src/apps/weather/WeatherApp.tsx', 'src/shared/schemas/app.weather.ts'],
  },

  {
    id: 'calendar',
    name: 'Calendar',
    category: 'utility',
    status: { label: 'Expanding', tone: 'info' },
    tagline: 'Today at a glance, with events parsed server-side from any iCal feed.',
    shot: 'calendar.png',
    shotNote: 'Captured with no ICS feed configured, so only the date composition renders — the server returned 503 and the app degraded to the date card.',
    description: [
      'The shipped version is deliberately minimal: weekday, a large date tile, and the month. Events come from <code>/api/calendar</code>, where the server fetches and parses the iCal feed so the browser never sees the secret calendar URL.',
      'PR #28 expands this substantially — Month, Week, and Details views laid out for the round display, plus the first app-level test file in the repository.',
    ],
    data: [
      ['Source', '<code>GET /api/calendar</code> — server-side ICS proxy'],
      ['Secret', '<code>CALENDAR_ICS_URL</code> never reaches the browser'],
      ['Schema', '<code>app.calendar</code> — feed URL, event count'],
    ],
    sitemap: {
      label: 'Calendar', sub: 'today view',
      children: [
        { label: 'Date card', sub: 'weekday · day · month' },
        { label: 'Event list', sub: 'when feed configured' },
        { label: 'Month view', sub: 'PR #28 — pending' },
        { label: 'Week view', sub: 'PR #28 — pending' },
        { label: 'Details view', sub: 'PR #28 — pending' },
      ],
    },
    flows: [
      {
        title: 'Server-proxied calendar fetch',
        steps: [
          { label: 'App fetches', sub: '/api/calendar' },
          { label: 'Server reads ICS', sub: 'env URL, server-side' },
          { label: 'Parse events', sub: 'to JSON list' },
          { label: 'Render', sub: 'date + events' },
        ],
      },
    ],
    tasks: [
      { t: 'PR #28 must be rebased before review', d: 'It branched before the radar merge, so its diff against main shows the radar files as deletions and will read as a revert.', tone: 'risk' },
      { t: 'Multi-day events', d: 'PR #28 includes a fix to render multi-day events on every day they span.', tone: 'info' },
    ],
    files: ['src/apps/calendar/CalendarApp.tsx', 'server/handlers.ts', 'src/shared/schemas/app.calendar.ts'],
  },

  {
    id: 'quote',
    name: 'Quote',
    category: 'ambient',
    status: { label: 'Shipped', tone: 'ok' },
    tagline: 'Quote of the day — the simplest app in the repository.',
    shot: 'quote.png',
    shotNote: 'Rendering from the bundled local quote list.',
    description: [
      'A centred typographic composition drawing from a local list in <code>quotes.ts</code>, with an optional remote JSON source for anyone who wants to supply their own.',
      'At 68 lines across two files it is the closest thing the codebase has to a template for a new app, and the best starting point for reading how registration and <code>AppProps</code> fit together.',
    ],
    data: [
      ['Source', 'Bundled <code>quotes.ts</code>, or a remote JSON URL'],
      ['Schema', '<code>app.quote</code> — source URL, rotation'],
    ],
    sitemap: {
      label: 'Quote', sub: 'static composition',
      children: [
        { label: 'Quote text', sub: 'centred' },
        { label: 'Attribution', sub: 'author' },
      ],
    },
    flows: [
      {
        title: 'Selection',
        steps: [
          { label: 'Mount', sub: 'pick index' },
          { label: 'Resolve source', sub: 'local or remote' },
          { label: 'Render', sub: 'quote + author' },
        ],
      },
    ],
    tasks: [
      { t: 'No rotation on a timer', d: 'Selection happens on mount. A kiosk left on one screen shows the same quote until it is navigated away from and back.', tone: 'info' },
    ],
    files: ['src/apps/quote/QuoteApp.tsx', 'src/apps/quote/quotes.ts'],
  },

  {
    id: 'photo-frame',
    name: 'Photos',
    category: 'ambient',
    status: { label: 'Shipped', tone: 'ok' },
    tagline: 'A slideshow cycling local photographs every eight seconds.',
    shot: 'photo-frame.png',
    shotNote: 'Rendering from whatever sits in public/photos on this machine.',
    description: [
      'Reads the photo manifest from <code>/api/photos</code>, which enumerates <code>public/photos/</code> on the device, then crossfades through the images on an eight-second cycle.',
      'The photo directory is gitignored — only a <code>.gitkeep</code> is tracked — and Vite copies its contents into the build output. Photos are therefore per-device, not shipped with the code.',
    ],
    data: [
      ['Source', '<code>GET /api/photos</code> — directory listing'],
      ['Storage', '<code>public/photos/</code>, gitignored'],
      ['Schema', '<code>app.photo-frame</code> — album selection'],
    ],
    sitemap: {
      label: 'Photos', sub: 'slideshow',
      children: [
        { label: 'Image layer', sub: 'crossfade' },
        { label: 'Empty state', sub: 'no photos found' },
      ],
    },
    flows: [
      {
        title: 'Slideshow cycle',
        steps: [
          { label: 'Fetch manifest', sub: '/api/photos' },
          { label: 'Preload next', sub: 'avoid flash' },
          { label: 'Advance 8s', sub: 'gated on isActive' },
          { label: 'Crossfade', sub: 'wrap at end' },
        ],
      },
    ],
    tasks: [
      { t: 'Album config is declared but thin', d: 'The schema exposes an album field; the directory listing is flat, so albums have nothing to select between yet.', tone: 'info' },
      { t: 'Candidate for absorption', d: 'The architecture doc asks whether a richer Photo Library app should absorb this one as its ambient mode.', tone: 'info' },
    ],
    files: ['src/apps/photo-frame/PhotoFrameApp.tsx', 'server/handlers.ts'],
  },

  {
    id: 'fireplace',
    name: 'Fireplace',
    category: 'ambient',
    status: { label: 'Shipped', tone: 'ok' },
    tagline: 'An ambient fire animation for a screen that is being looked at, not read.',
    shot: 'fireplace.png',
    shotNote: 'Live animation captured mid-frame.',
    description: [
      'A self-contained ambient scene with no data dependencies and no network calls — which makes it the most reliable app on the fleet and a useful control when diagnosing whether a kiosk problem is rendering or data.',
      'Its animation is gated on <code>isActive</code>, so it stops burning CPU the moment the app grid opens over it. On a Pi 4 driving a 1080×1080 panel that gating is the difference between a warm case and a hot one.',
    ],
    data: [
      ['Source', 'None — fully self-contained'],
      ['Schema', '<code>app.fireplace</code> — intensity, palette'],
      ['Ticking', 'Animation gated on <code>isActive</code>'],
    ],
    sitemap: {
      label: 'Fireplace', sub: 'ambient scene',
      children: [
        { label: 'Flame layer', sub: 'animated' },
        { label: 'Ember layer', sub: 'animated' },
      ],
    },
    flows: [
      {
        title: 'Active-gated animation',
        steps: [
          { label: 'isActive true', sub: 'start loop' },
          { label: 'Animate frame', sub: 'flames + embers' },
          { label: 'isActive false', sub: 'grid opened' },
          { label: 'Stop loop', sub: 'CPU released' },
        ],
      },
    ],
    tasks: [
      { t: 'Candidate for absorption', d: 'The architecture doc asks whether a Nature scene-picker app should absorb Fireplace, since scenes are scenes.', tone: 'info' },
      { t: 'Would exercise AmbientMedia', d: 'One of three apps that motivate the unbuilt <code>AmbientMedia</code> primitive for video/audio with crossfade.', tone: 'info' },
    ],
    files: ['src/apps/fireplace/FireplaceApp.tsx'],
  },

  {
    id: 'fitness',
    name: 'Fitness',
    category: 'productivity',
    status: { label: 'Thin', tone: 'warn' },
    tagline: 'An exercise counter with a progress ring — and the most important app not yet built.',
    shot: 'fitness.png',
    shotNote: 'The shipped counter. The real Fitness app described below does not exist yet.',
    description: [
      'What ships today is a tap-to-increment counter with a progress ring and a configurable exercise label, persisted to <code>localStorage</code>. Eighty-four lines, no data dependencies.',
      'What matters about Fitness is what it is <em>meant</em> to become. The architecture doc names it the next build precisely because the real version — exercise groups, sets within a group, an active timed circuit — is the one app that would force five unbuilt primitives and a three-level navigation stack into existence against a real call site. It is the designated forcing function for the entire primitive kit.',
    ],
    data: [
      ['Storage', '<code>localStorage</code> — <code>superclock-fitness-count</code>'],
      ['Schema', '<code>app.fitness</code> — exercise label'],
      ['Source', 'None'],
    ],
    sitemap: {
      label: 'Fitness', sub: 'shipped today',
      children: [
        { label: 'Counter ring', sub: 'tap to increment' },
        { label: 'Groups list', sub: 'planned — ScenePicker' },
        { label: 'Sets list', sub: 'planned — RoundList' },
        { label: 'Active circuit', sub: 'planned — IntervalTimer' },
        { label: 'Week stats', sub: 'planned — WeekRing' },
      ],
    },
    flows: [
      {
        title: 'Today — counter',
        steps: [
          { label: 'Read stored count', sub: 'localStorage' },
          { label: 'Tap', sub: 'increment' },
          { label: 'Update ring', sub: 'progress arc' },
          { label: 'Persist', sub: 'localStorage' },
        ],
      },
      {
        title: 'Planned — three-level drill-down',
        steps: [
          { label: 'Groups', sub: 'tier 2' },
          { label: 'Sets', sub: 'tier 3' },
          { label: 'Active circuit', sub: 'tier 3, timed' },
          { label: 'Back stack', sub: 'no shell support' },
        ],
      },
    ],
    tasks: [
      { t: 'The real Fitness app is unbuilt', d: 'Groups → sets → active circuit. This is the single highest-leverage piece of work in the repository because of what it forces into existence.', tone: 'risk' },
      { t: 'Tier-3 navigation does not exist', d: 'Fitness needs three levels deep. The shell supports tiers 0 and 1; drill-down with a back stack has no implementation at all.', tone: 'risk' },
      { t: 'Uses a bare localStorage key', d: 'Written directly rather than through a namespaced, schema-validated <code>useScopedStorage</code> hook, which does not exist yet.', tone: 'warn' },
    ],
    files: ['src/apps/fitness/FitnessApp.tsx', 'src/shared/schemas/app.fitness.ts'],
  },

  {
    id: 'habits',
    name: 'Habits',
    category: 'productivity',
    status: { label: 'Shipped', tone: 'ok' },
    tagline: 'Daily habit tracking with streaks, and one of only two apps using tier-2 navigation.',
    shot: 'habits.png',
    shotNote: 'The daily view. Swiping vertically switches to the monthly view.',
    description: [
      'Two peer sub-views — daily and monthly — switched by vertical swipe. Along with Clock it is one of only two apps in the codebase that registers a vertical-swipe callback, which makes it the reference implementation for tier-2 navigation.',
      'That pattern is entirely hand-rolled: there is no shell hook and no metadata flag for it. Every app that wants peer sub-views copies this registration and remembers to tear it down on deactivate.',
    ],
    data: [
      ['Storage', '<code>localStorage</code> — completion by date'],
      ['Schema', '<code>app.habits</code> — habit list'],
      ['Navigation', 'Registers <code>setVerticalSwipeCallback</code>'],
    ],
    sitemap: {
      label: 'Habits', sub: 'two peer views',
      children: [
        { label: 'Daily', sub: 'today · tap to complete' },
        { label: 'Monthly', sub: 'grid · streaks' },
      ],
    },
    flows: [
      {
        title: 'Tier-2 view switching',
        steps: [
          { label: 'Become active', sub: 'isActive true' },
          { label: 'Register callback', sub: 'on nav store' },
          { label: 'Swipe ↕', sub: 'root handler routes' },
          { label: 'Toggle view', sub: 'daily ⇄ monthly' },
          { label: 'Deactivate', sub: 'clear callback' },
        ],
      },
    ],
    tasks: [
      { t: 'A radial rewrite is stranded on a branch', d: 'A radial-daily and concentric-monthly rewrite exists unmerged. It is neither in nor out.', tone: 'warn' },
      { t: 'Tier-2 boilerplate is copy-pasted', d: 'A shared <code>useVerticalSwipeViews</code> hook would remove the registration and teardown from every app that wants peer views.', tone: 'info' },
      { t: 'Would exercise WeekRing', d: 'The weekly summary block that five or more trackable apps want, and none can share yet.', tone: 'info' },
    ],
    files: ['src/apps/habits/HabitsApp.tsx', 'src/shared/schemas/app.habits.ts'],
  },

  {
    id: 'time-tracking',
    name: 'Timer',
    category: 'productivity',
    status: { label: 'Radar-aware', tone: 'ok' },
    tagline: 'A Pomodoro timer that notices when you leave the desk.',
    shot: 'time-tracking.png',
    shotNote: 'The timer face at rest.',
    description: [
      'A focus timer with a configurable task label — and the only app that consumes the occupancy service. It reads <code>/api/occupancy</code> for today’s at-desk total, per-hour buckets, and a seven-day history.',
      'The radar integration is the interesting part: the timer auto-pauses after 45 seconds of measured absence and resumes when you return. Occupancy sessions are derived from presence transitions server-side, with dropouts shorter than 60 seconds merged into the surrounding session so a brief walk past the sensor does not fragment a work block.',
    ],
    data: [
      ['Source', '<code>GET /api/occupancy</code> — desk-time summary'],
      ['Radar', 'Auto-pause after 45s absence, auto-resume'],
      ['Schema', '<code>app.time-tracking</code> — task label'],
    ],
    sitemap: {
      label: 'Timer', sub: 'pomodoro',
      children: [
        { label: 'Countdown', sub: 'running · paused' },
        { label: 'Occupancy', sub: 'today · 7-day' },
      ],
    },
    flows: [
      {
        title: 'Presence-driven auto-pause',
        steps: [
          { label: 'Timer running', sub: 'counting down' },
          { label: 'Radar loses presence', sub: 'absence begins' },
          { label: 'Wait 45s', sub: 'debounce' },
          { label: 'Auto-pause', sub: 'clock held' },
          { label: 'Presence returns', sub: 'auto-resume' },
        ],
      },
    ],
    tasks: [
      { t: 'Auto-pause is unverified on real hardware', d: 'The behaviour is driven by the radar service, which runs against the mock driver until the A121 protocol is calibrated.', tone: 'warn' },
      { t: 'Would exercise IntervalTimer', d: 'One of four apps wanting a shared sequenced-countdown primitive — the others being Fitness circuits, Breathing, and Pomodoro itself.', tone: 'info' },
    ],
    files: ['src/apps/time-tracking/TimeTrackingApp.tsx', 'server/occupancy/service.ts', 'src/shared/occupancy.ts'],
  },

  {
    id: 'github',
    name: 'GitHub',
    category: 'productivity',
    status: { label: 'Shipped', tone: 'ok' },
    tagline: 'A contribution heatmap bent around a watch face.',
    shot: 'github.png',
    shotNote: 'Captured with no token configured — the honest “not connected” state, with the empty contribution ring still legible.',
    description: [
      'The contribution graph re-plotted radially: each day becomes a dot on a ring, so a year of activity wraps the bezel instead of running off a rectangle. The densest visual in the app catalogue.',
      'It was recently hardened and is now a reference for the honest-offline rule: it serves a last-good cache when the network drops, shows an explicit empty state when unconfigured, and no longer falls back to mock data pretending to be real contributions.',
    ],
    data: [
      ['Source', '<code>GET /api/github/contributions</code> — server proxy'],
      ['Secret', '<code>GITHUB_TOKEN</code> server-side; rotate without rebuild'],
      ['Offline', 'Last-good cache, then explicit empty state'],
    ],
    sitemap: {
      label: 'GitHub', sub: 'radial viz',
      children: [
        { label: 'Contribution ring', sub: 'day dots' },
        { label: 'Summary', sub: 'totals' },
        { label: 'Not-connected', sub: 'explicit state' },
      ],
    },
    flows: [
      {
        title: 'Proxied fetch with cache fallback',
        steps: [
          { label: 'Fetch proxy', sub: '/api/github' },
          { label: 'Server adds token', sub: 'never in browser' },
          { label: 'Render ring', sub: 'and cache it' },
          { label: 'On failure', sub: 'cache, else empty' },
        ],
      },
    ],
    tasks: [
      { t: 'No valid token exists anywhere', d: 'The plumbing is correct and server-side, but no working personal access token is provisioned, so every device shows “not connected”.', tone: 'warn' },
      { t: 'Would exercise RadialViz', d: 'The clearest call site for the perimeter-as-time primitive that six or more apps want.', tone: 'info' },
    ],
    files: ['src/apps/github/GithubApp.tsx', 'server/github-proxy.ts'],
  },

  {
    id: 'claude-usage',
    name: 'Claude Usage',
    category: 'productivity',
    status: { label: 'Needs daemon', tone: 'warn' },
    tagline: 'Rate-limit utilization, reported by a pixel-art cow whose mood tracks your budget.',
    shot: 'claude-usage.png',
    shotNote: 'Captured with an expired token — Clawd still renders while the app reports “auth expired — open claude code” and the underlying HTTP 401.',
    description: [
      'Session and weekly Claude Code rate-limit utilization, drawn as two bars beneath Clawd — a pixel-art character whose sprite and mood are selected from how much budget remains. It is the most characterful app in the fleet and the only one with a mascot.',
      'It depends on something outside this repository: a Mac LaunchAgent serving usage data on port 47823 with a valid subscription token. When the numbers vanish, the daemon is down or the token has expired — the app itself is fine, and says so precisely.',
    ],
    data: [
      ['Source', '<code>GET /api/claude-usage</code> → Mac daemon on :47823'],
      ['Schema', '<code>app.claude-usage</code>'],
      ['Failure', 'Names the cause — expired auth vs missing headers'],
    ],
    sitemap: {
      label: 'Claude Usage', sub: 'ring face + sprite',
      children: [
        { label: 'Clawd sprite', sub: 'mood-selected' },
        { label: 'Session bar', sub: 'utilization' },
        { label: 'Week bar', sub: 'utilization' },
        { label: 'Status line', sub: 'explicit failure cause' },
      ],
    },
    flows: [
      {
        title: 'Usage fetch and mood selection',
        steps: [
          { label: 'Fetch proxy', sub: '/api/claude-usage' },
          { label: 'Daemon replies', sub: 'or 401' },
          { label: 'Pick mood', sub: 'from utilization' },
          { label: 'Draw sprite', sub: 'and bars' },
        ],
      },
    ],
    tasks: [
      { t: 'Depends on an out-of-repo daemon', d: 'A Mac LaunchAgent must be installed and holding a valid token. Never install it from a worktree path — the path dangles when the worktree is removed.', tone: 'warn' },
      { t: 'Token expiry is the usual failure', d: 'The 401 state is well handled and self-describing, but there is no alerting — you find out by looking at the clock.', tone: 'info' },
    ],
    files: ['src/apps/claude-usage/ClaudeUsageApp.tsx', 'src/apps/claude-usage/useMood.ts', 'server/claude-usage-proxy.ts', 'mac-daemon/'],
  },

  {
    id: 'breathing',
    name: 'Breathing',
    category: 'utility',
    status: { label: 'Blocked', tone: 'risk' },
    tagline: 'Live respiration rate from a 60 GHz radar — working in software, blocked in firmware.',
    shot: 'breathing.png',
    shotNote: 'Captured against the mock radar driver. Note the “mock data” badge, which the app shows whenever the source is not a real sensor.',
    description: [
      'A ring that inflates and deflates at your measured breathing rate, with the rate in the centre and a presence dot and distance readout beneath. One full breath is 60/rpm seconds; while searching it idles at a calm twelve.',
      'The lease design is the careful part. The app leases breathing mode from the radar service and renews every 30 seconds; the server reverts the sensor to presence mode 90 seconds after the last renewal. A kiosk that crashes or navigates away therefore cannot pin the sensor into breathing mode and silently disable presence wake for the whole device.',
    ],
    data: [
      ['Source', '<code>GET /api/radar/stream</code> — SSE snapshots'],
      ['Lease', '<code>POST /api/radar/mode</code> — renewed every 30s, expires at 90s'],
      ['Schema', '<code>app.breathing</code> — show distance'],
    ],
    sitemap: {
      label: 'Breathing', sub: 'ring face',
      children: [
        { label: 'Breathing ring', sub: 'animates at measured rpm' },
        { label: 'Rate readout', sub: 'or em-dash' },
        { label: 'Presence + distance', sub: 'status row' },
        { label: 'Mock badge', sub: 'when source is not real' },
      ],
    },
    flows: [
      {
        title: 'Mode lease lifecycle',
        steps: [
          { label: 'Become active', sub: 'isActive true' },
          { label: 'Lease breathing', sub: 'POST mode' },
          { label: 'Renew 30s', sub: 'while active' },
          { label: 'Leave app', sub: 'release to presence' },
          { label: 'Or expire 90s', sub: 'server reverts' },
        ],
      },
    ],
    tasks: [
      { t: 'Mode switching does nothing on real hardware', d: 'The serial driver’s <code>setMode</code> logs “protocol calibration pending” and sends no command. Presence and breathing are mutually exclusive in the flashed firmware, so this app cannot work on a real sensor today.', tone: 'risk' },
      { t: 'PR #29 is the fix, and needs the sensor', d: 'A 259-line Python exploration-server sidecar moves the DSP host-side. It is the only open work item gated on physical hardware rather than time.', tone: 'risk' },
      { t: 'No protocol tests', d: 'The radar parser is the newest and least verified code in the repository. Captured serial lines would make good fixtures.', tone: 'warn' },
    ],
    files: ['src/apps/breathing/BreathingApp.tsx', 'src/core/radar.ts', 'server/radar/driver.ts', 'server/radar/protocol.ts'],
  },
];
