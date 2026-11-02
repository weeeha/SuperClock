# App functional and design review, 2026-11-01

Every kiosk app driven in the dev kiosk at a true 1080 x 1080, day and night, with a real pointer on the control that matters in each app and scripted navigation (`window.__nav`) for the rest. Branch `claude/review-status-3b48fc` at `4522823` (equal to `origin/main`). Nothing was edited: this is a report, and the fixes it names are for Nick to pick.

**Gates:** `./scripts/gates.sh` green: lint, `check:tokens`, 128 files / 1413 tests, build. The first run failed at build only because this worktree's `node_modules` predated Rally (`three`) and Fields (`@fontsource-variable/nunito`); `npm ci` fixed it. `check:rules`: 1 blocker, the pre-existing `ICO-2` emoji icon on `src/apps/todo/index.ts:8`.

**Setup:** the dev server's device config was empty, so a config with one instance per app was pushed through `POST /api/device/config` (Weather Montreal, GitHub `weeeha`, Countdown Christmas 2026 from 1 Oct, Fitness one round of 10 s work / 5 s rest, Focus with two projects). A second push switched `settings.skin` to `fields` and the fireplace to blue / roaring. The dev server runs the mock radar driver (`server/radar/service.ts:117`), which only dev and tests get.

**Not covered here:** anything on a Pi; audio (timer chime, workout beeps and voice, alarm ring); an alert actually firing (timer end, alarm time, snooze, gentle wake, panel wake); GitHub with a token; Calendar with a feed (week, month and details with real events); the photo slideshow (no photos in dev); AI Face beyond the default design; the admin UI; arc-zone gestures and the three-finger home (the callbacks were called directly, the touch grammar was not).

## Per app

| App | What was exercised | Result |
| --- | --- | --- |
| Clock | 20 faces cycled through the vertical-swipe callback; Minimalismo by day and night | Pass, zero console errors across the cycle (1 iframe face, 6 canvas faces) |
| Weather Classic | Six pages up, clamp at the last, down returns, live Montreal data (11°, clear, sunrise arc) | Pass |
| Weather Fields | Now page, Temperature metric page with its chart; day and night | Pass, with the loading finding below |
| Calendar Classic | Cover → week → month → year ladder, real tap on a week row → day view, back gesture → week | Pass, with the month-tell finding below |
| Calendar Fields | Cover "No calendar yet / Add a calendar feed on the server", day and night | Pass |
| Quote | Real tap anywhere → next quote (full-disc button) | Pass |
| Photo Frame | Empty tell with `/api/photos` returning `[]` | Pass (slideshow untested) |
| Fireplace | Canvas at 1000 x 1000; classic, then blue / roaring from config | Pass |
| Fitness | Swipe up changes the workout; real tap → 3 s countdown → work; real tap → paused (pause glyph, "3 OF 4 · MOUNTAIN CLIMBERS"); swipe up while paused → abort → ready; rest phase shows "NEXT · PLANK"; dark at night | Pass |
| Habits | Real tap on a disc → "1 of 7 today" and persisted; swipe up → month ring ("14% of November"); swipe down; tap again → "0 of 7" | Pass |
| Focus (time-tracking) | Real tap → running, "TAP TO PAUSE"; swipe up → task picker; real tap on Pegbo → timer labelled Pegbo; swipe up → day summary from `/api/occupancy`; real tap → paused | Pass, with the idle-return finding below |
| GitHub | No token: "GitHub not connected / add a GitHub token on this clock"; swipe does nothing on the tell | Pass (ring view untestable) |
| Claude usage | Live daemon data (session 0%, week 70%, resets 4d 7h); swipe up → detail view; down → pet | Pass |
| Breathing | 11 breaths/min with the "MOCK DATA" chip on the dev mock | Pass |
| Agents | Real tap on the Lifey row → chat; swipe up → avatar; swipe down → chat; header tap → list | Pass, mock data only |
| Todo | "+ Add" → overlay with 31 keys; x, Backspace, b u y, Space, m i l k; "Save todo" → "1 open, buy milk" persisted; real tap on the row → Done; swipe up → Done view; "Clear all" → "Tap again to clear" → cleared; swipe down | Pass |
| Countdown | Progress ring "54 days to Christmas, since 1 Oct 2026"; Fields "54 days to go, Friday 25 December"; night | Pass (weeks style untested) |
| Timer | Preset 3 min; dial drag → 18:00; Start; real tap → "Paused" with the muted ring; real tap → resumes; 900 ms press → reset to "Set timer 18:00" | Pass |
| AI Face | `core-eyes/wheatley` iframe loads, "Demo" label; asleep at night | Pass |
| Alarm | Add alarm → edit: dial drag → 07:15, "Switch the dial to hours", day pills, Done → list "07:15" with switch; real tap on the switch → off, resting "All alarms off / Turn one on in the list"; real tap on the row → edit; Delete → empty list; store `[]` | Pass |

**Shell:** quick-settings sheet: real tap on the night toggle flips `<html>` to `dark`; real drag on the brightness slider sets 63 and `brightness(0.63)`; the sheet stays open under both (a drag with the sheet open resolves to dismiss or nothing, `gesture-resolve.ts:42`). Grid: 18 tiles inside the disc, real tap on Fitness opens it. The grid and the sheet closed on their own after 20 s untouched, which is the designed overlay idle.

## Findings, ranked

### Defects (off-system, no decision needed)

1. **Taps do not count as activity for the five-minute idle return.** `lastGestureMs` is written only by swipes, grid and sheet open/close, the sheet's controls and the alert store (`src/core/navigation.ts:116-157`, `QuickSettings.tsx:107,122`); nothing in the gesture hook notes a plain tap. `checkIdle` (`src/core/hooks/useIdleReturn.ts:40`) then switches to the home app after 5 min. Seen live: the running Timer jumped to the clock on the five-minute mark with no gesture in the nav log. Who loses what: Fitness suspends its circuit (`takeSuspendedCircuit`, `FitnessApp.tsx:75`) and survives; Focus keeps `elapsed` and `running` in component state (`TimeTrackingApp.tsx:298-299`) and loses the running session; the Timer lives in a store and survives. Fix: call `noteUserGesture()` on every pointerdown in `useGestures`, and hold the home return while a session app is running (Fitness, Focus, Alarm edit).
2. **Calendar Classic month view: the "calendar not configured" tell sits on the sixth week row.** `CalendarApp.tsx:233` places it at `bottom-[13%]`; November 2026 has six rows and the last row ("30 1 2 3 4 5 6") runs under the sentence. Fix: lift the tell above the grid, or let the grid reserve the band.
3. **Weather Fields shows an empty disc on every visit.** `useWeather` refetches on mount with no persisted model, and the Fields `!model` branch (`FieldsWeather.tsx:174`) renders only the "Weather" title and the dots for about a second (the classic skin says "loading…"). On a Pi with a slow link it is a blank flash on every swipe to Weather. Fix: keep the last model (localStorage, the config-cache pattern) and show it stale, or draw a matched skeleton.
4. **Weather Classic says "weather offline" when no location is configured** (`WeatherApp.tsx:118`), while the hook already reports `unconfigured`. Open since the Oct 23 review.
5. **GitHub's dead-token tell reads "server unreachable"** (`GithubApp.tsx:227`): only the `GITHUB_TOKEN` string maps to a hint, a 401 does not. Open since Oct 23.
6. **Schema options the apps do not read are offered as live in the admin:** Quote `source: url` and `sourceUrl` (`QuoteApp.tsx:27`), Photo Frame `source` and `sourcePath`, Habits `weekStart` and `theme`, Focus `weekStart`, Claude usage `scope` (`ClaudeUsageApp.tsx:73`). Phase 0: an unimplemented option renders disabled with its schema-meta note.
7. **`ICO-2` blocker:** the emoji icon on `src/apps/todo/index.ts:8`.
8. **The two dials call `setPointerCapture` unguarded** (`TimerDial.tsx:29`, `AlarmDial.tsx:27`). It threw `NotFoundError` on a synthetic pointer during this review; a real touch carries a live pointer id, so the risk is low, but a `try` costs nothing.

### Judgment (Nick decides)

- **Caps microcopy** is still on glass: "TAP TO START / TAP TO PAUSE / TAP TO RESUME" (Focus, Fitness), "GET READY · CRUNCHES", "FULL BODY", "AT DESK TODAY", "THIS WEEK · OCT 26 – NOV 1", "TASK". The rest of the kiosk is sentence case.
- **Middle dots join meta strings** in Weather Classic ("MONTREAL · 14:40"), the Calendar week and day headers, Fitness ("3 OF 4 · MOUNTAIN CLIMBERS"), Alarm ("Gentle wake 10 min · snooze 9 min", "Dial sets minutes · tap the time for hours"), Claude usage ("14:44 · just now").
- **Em dashes** in the Todo empty sentence and in every Agents subtitle.
- **Agents is mock end to end**, including "● listening…" and the unread dots; the board's not-connected, error and no-mic frames are not built.
- **A new alarm defaults to no days**; what a day-less alarm does when saved was not tested.
- **Fitness paused** carries a pause glyph and no word; Timer paused says "Paused". Pick one convention.
- Three visual worlds, the accent reaching five apps, pagers on four apps, the GitHub and Claude usage mono identity: unchanged from the Oct 23 review.

### Functions planned but not present

| App | Missing |
| --- | --- |
| Agents | a real provider (Telegram or lifeos adapter replaces `mockAgentProvider`) |
| AI Face | 25 of 50 designs; SP2 families, SP3 on-glass qualification and admin thumbnails, SP4 the main-agent source |
| Todo | delete one item, manual reorder, cross-device sync, voice capture (deferred by the spec) |
| Habits | habit detail; the month ring is read-only; `weekStart` and `theme` unread |
| Breathing | the guided session from the board |
| Notes | on the board, never built |
| Calendar | nothing to show in week, month or details until a feed exists |

## Method notes for the next reviewer

- `window.__nav` is the nav store. Drive apps with `switchToApp(id)` then `finishTransition()`; call `noteUserGesture()` first, or the 5-min idle return pulls every scripted visit back to the clock and the grid and sheet close after 20 s.
- Vertical-swipe callbacks: `up` is "next page" in every paged app; `down` on page 0 opens the grid.
- Buttons with pointer handlers (Timer readout, the dials) ignore a synthetic `click()`; use a real pointer. The Browser pane screenshots run at a 800 px frame for the 1080 viewport, so a DOM box scales by 800/1080.
