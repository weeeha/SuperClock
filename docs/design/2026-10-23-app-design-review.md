# App design review, 2026-10-23

Reviewed: every kiosk app on the merged train (`f21a29c`, local main), rendered in the dev kiosk at a true 1080 x 1080 with one instance per app, day and night palettes, Classic and Fields skins, plus the app grid. Nothing edited. Findings are labelled **off-system** (disagrees with the token layer or a Phase 0 rule, just fix) or **judgment** (defensible either way, Nick decides).

**Gates:** `check:tokens` pass. `check:rules` 1 blocker (`ICO-2`, the emoji `icon` on `src/apps/todo/index.ts:8`, pre-existing) and six rules it cannot run (CPY-4, STA-1, STA-5, STA-7, KIO-2, FCE-1), which this review covers by eye.

Not covered: motion (the preview pane throttles animation), real touch targets, the Agents chat view, Timer and Alarm ringing, the clock faces (reviewed separately in September).

## Cross-cutting, ranked

1. **The carousel has no shared surface.** Judgment, but it is the single biggest "unfinished" tell. In the day palette seven apps sit on white (Clock, Timer, Alarm, Countdown Classic, Quote, Photo Frame, Fitness) and eleven on pure black (Weather Classic is navy). Swiping goes white, black, white, black. Every dark app hardcodes it: `bg-black` appears 3 to 12 times per app in `agents`, `calendar`, `claude-usage`, `github`, `habits`, `todo`, `time-tracking`, `weather`; none of them reads `--surface-*`. Phase 0 reserves pure `#000` for the night tokens, so this is also **off-system** per occurrence. Decide one of: every app follows the palette (day light, night dark) like Timer and Alarm already do, or the kiosk is dark-only and the light apps convert.
2. **Night mode does not reach Fitness.** Off-system. `FitnessApp` paints the same beige disc at night, the brightest screen in the set. Habits, Todo, Agents, Focus, Breathing, GitHub, Claude usage are black in both palettes, so "night" changes nothing on them except brightness dimming.
3. **Scale is set for a phone, not a 1080 disc viewed from a metre away.** Judgment. Measured: Todo's empty-state line is 16 px and sits 200 px below its own "+ Add" button with the lower 60 percent of the disc empty; Agents row subtitles are 16 px with 56 px avatars; Alarm's empty state is 28 px text with a 130 px icon ring centred in a 1080 disc; Calendar Classic's "calendar not configured" tell is the smallest text on screen, tucked at the disc's bottom edge; Habits' "0/7" is 24 px. Compare Timer, Countdown, Weather and Fields, which fill the disc. The reference that already works is Fields: title, one hero number, one subline.
4. **Three visual worlds on one device.** Judgment. (a) Flat Inter on black or white (most apps). (b) Retro terminal: GitHub's dotted spiral and Claude usage's pixel grid, both in `font-mono` (3 uses, the only non-Inter family in `src/apps`). (c) Fields: Nunito Black on saturated category fields, plus Fitness's 3D-rendered character on beige. Each is defensible alone; together the carousel reads as three products. The Fields decision covers 3 of 18 apps on fastclock today.
5. **Pager dots are 6 px.** Off-system against the circle-crop rule: they sit at y = 1050 in a 1080 disc, inside the bezel shadow on the round panels, and only Weather, Calendar, Habits, Todo and Focus draw them while other multiView apps (Agents, GitHub, Alarm) do not. One pager component, one size, one position, or none.
6. **Developer strings on glass.** Off-system (copy). Photo Frame: "pictures are read from public/photos/ and ship with the build" (`PhotoFrameApp.tsx:139`). GitHub: "set GITHUB_TOKEN on the server" (`GithubApp.tsx:227`). Claude usage prints the raw upstream error, today "keychain: no accessToken in keychain entry" (`ClaudeUsageApp.tsx:240-244`), and labels any failure "auth expired". Calendar Fields: "Add a calendar feed on the server" is the right register. Each tell should say what to do in the admin or on the Mac, in the app's own words.
7. **Em dashes in kiosk copy.** 63 files under `src/apps` contain one; on screen in Todo ("All clear — tap + Add to capture something.") and every Agents subtitle. Your prose rule, applied to microcopy.
8. **Caps microcopy.** "TAP TO START" in Focus and Fitness, sentence case everywhere else ("Set timer", "Add alarm", "+ Add"). Pick one; the codebase is 16 to 2 for sentence case.
9. **The app grid is stale art.** Off-system (fabrication). Tiles show a family photo, "30°" weather for "FRI 13-08", "Tuesday 17 April", a quote by "Stewart", a 33-day Countdown reading "214"; none is produced by the app behind it. The Todo and Countdown labels clip at the right edge, and the 7-column Figma layout (`AppGrid.tsx:32`) puts corner tiles outside the disc on a round panel.
10. **The accent setting is honoured by five apps.** Judgment. `#ff6b35` shows in Countdown Classic, Todo, Focus, Breathing and Fireplace. Fields uses its category hues (blue, red, pink), GitHub and Claude usage their own palettes, Agents and AI Face blue. Either the accent is a fleet setting or it is not.

## Per app

| App | Day | Night | Finding | Kind |
| --- | --- | --- | --- | --- |
| Clock (Minimalismo) | fine | fine | Reviewed in September; nothing new. | |
| Weather Classic | navy disc, sunrise arc, 6 dots | same | Only app on a third surface colour; "weather offline" when a location is missing (`WeatherApp.tsx:114`). | off-system |
| Weather Fields | blue field, Nunito, hourly panel | navy | The strongest screen in the set. Chart panel shortens honestly. | fine |
| Calendar Classic | black, red tile, tiny tell | same | Tell at the smallest size on screen; the tile is the only element with a radius in the app. | judgment |
| Calendar Fields | red field, icon, sentence, action | pink on black | Right empty state. | fine |
| Countdown Classic | white, grey ring, accent arc | not checked | Fills the disc; "since 1 Oct 2026" caption in the same grey as the ring reads as disabled. | judgment |
| Countdown Fields | pink field | pink on black | Fine. | fine |
| Timer | white, chip row | dark | Fine in both; the only app with a proper selected chip state. | fine |
| Alarm | white, icon ring | dark | Correct anatomy (icon, sentence, action), phone scale. Off-switch contrast 1.42:1 (logged 2026-10-02). | judgment / off-system |
| GitHub | black, dotted spiral, mono | same | Env var in the tell; mono family is the app's whole identity, decide whether it stays. | off-system / judgment |
| Claude usage | black, pixel Clawd, mono | same | Raw error string; "auth expired" shown for any failure. | off-system |
| Habits | black, 7 grey discs | same | All seven discs identical grey with 30 px white labels: nothing is dominant, no empty-state sentence, "0/7" at 24 px. | judgment |
| Todo | black, top-third content | same | 16 px empty copy, 200 px from its action, lower disc empty; "+ Add" uses a plus glyph as an icon. | judgment |
| Focus | black, ring, "TAP TO START" | same | Three type sizes stack with equal spacing, so the ring and the clock compete; desk-time bar is 2 px. | judgment |
| Breathing | black, orange ring glow | same | Honest "MOCK DATA" chip. The glow is a radial gradient inside the ring, allowed as ambient. | fine |
| Fitness | beige disc, 3D figure, hearts | beige | Ignores night; the only illustrated app; "TAP TO START". | off-system |
| Photo Frame | white, two lines | not checked | Dev path on glass; no action. | off-system |
| Quote | white, two lines | dark | Fine in both. Author at the smallest size. | fine |
| Fireplace | black, flames | same | Fine. | fine |
| Agents | black list, 56 px avatars | same | Mock copy with em dashes; the last row fades under the RoundList mask; unread dots at the disc edge. | judgment |
| AI Face | black, "Demo" 16 px label | same | Fine. The "Demo" tell could sit lower, inside the arc ring. | fine |

## What I would do, in order

1. Decide finding 1 (one surface rule) and 4 (one or three visual worlds). Everything below follows from these two.
2. Fix the off-system rows without a decision: Fitness night, the three developer tells, the raw error string, pager dots, the grid art and clipping.
3. Scale pass on Todo, Agents, Alarm, Habits, Calendar Classic using the Fields recipe (title, hero, subline).
4. Copy pass: em dashes out, one case for action labels.

Screens: the preview pane at `http://localhost:5180` (dev server `dev`, worktree config holds one instance per app).
