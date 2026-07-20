# SuperClock health report — Fable 5 review, 2026-07-16

Baseline: `main` @ `f8f3d54` (post night-mode PR #20). `npm run lint` and `tsc -b` both pass clean. No test runner exists. Three parallel review passes (server/runtime, client/apps, architecture) + manual verification of headline findings.

**Verdict:** the codebase is in decent shape file-by-file (no god files, hooks discipline is real, the night-mode work is solid), but it has outgrown its own architecture story. The real risks cluster in four places: the fleet persistence/config layer, the display adapter's boot behavior, a half-plumbed admin→kiosk config pipeline, and a hand-maintained deploy payload that has already caused one outage.

---

## Critical — real bugs with kiosk-level blast radius

### C1. Playlist rotation between two clock instances wedges the kiosk untouchable ✅ verified by hand
[SwipeContainer.tsx:37](../../../src/core/components/SwipeContainer.tsx) keys the animated view on `activeAppId` only; `switchToInstance` ([navigation.ts:58](../../../src/core/navigation.ts)) sets `mode: 'transitioning'` even when the app id is unchanged. Switching between two instances of the *same* app (two clock faces — exactly what the Playlist admin UI creates) triggers no exit animation, so `onExitComplete → finishTransition()` never fires and `mode` sticks at `'transitioning'` forever. Every gesture handler gates on `mode === 'app' | 'grid'`, so **all touch input dies** while rotation keeps visually working (config still updates), masking the wedge. Also fires at boot via `usePlaylistAutoRotate`'s initial `goto(0)` when the first playlist item is a clock.
**Fix:** key on `activeInstanceId ?? activeAppId`, or skip `'transitioning'` when appId is unchanged.

### C2. Corrupt `fleet.json` permanently 500s all config/fleet routes — no self-heal
`readJson` ([fleet-store.ts:28-43](../../../server/fleet-store.ts)) only swallows `ENOENT`; a `SyntaxError` propagates forever. The tmp+rename write is atomic but there's no `fsync` before rename — power loss on an SD card can still leave a zero-length/garbled file. Result on a headless Pi: every `GET /api/device/config` and all `/api/admin/*` fleet routes 500 for the life of the device; the kiosk limps on stale localStorage.
**Fix:** on parse failure, quarantine the corrupt file (rename to `fleet.json.corrupt-<ts>`), fall back to `fleet.example.json`/`defaultFleet()`, log loudly. Add `fsync` before rename.

### C3. Display adapter: sleep schedule is a boot-order coin flip; restarts can strand the panel off
- `probeSupport()` runs once at `listen` and caches `ok:false` forever ([display-adapter.ts:60,120-137](../../../server/display-adapter.ts)). The systemd unit races labwc's Wayland socket; if the server wins, the sleep schedule silently does nothing until the next restart — panel stays on all night.
- Startup assumes `applied = { poweredOn: true }` (line 64). If the server restarts while the panel is off, the wake `--on` is suppressed → black panel up to ~23h.
- The known-dead `--brightness` branch (lines 224-241) still retries + warns every 30s (~2,880 journal lines/day). *(PR #21 fixes this part — merge it.)*
**Fix:** re-probe on failure with backoff; treat power state as unknown at startup (assert once); excise the dead brightness path.

### C4. `POST /api/device/config` is unauthenticated AND unvalidated on every device
[device-routes.ts:29-47](../../../server/device-routes.ts) — no token (docs/admin/foundation.md *claims* there is one), and the body is spread raw into persisted config: `{...current, ...patch}`. Any LAN host can push `playlist: null` (crashes instance CRUD + can crash the kiosk client on every poll until the file is hand-fixed) or a `{wake:"00:00", sleep:"00:01"}` schedule (turns the panel off). Admin PATCH ([admin-routes.ts:86-93](../../../server/admin-routes.ts)) has the same no-validation problem behind its token. zod is already everywhere — it's just not applied to these bodies.
**Fix:** shared `deviceConfigSchema` zod in `src/shared/`, applied on both routes; reuse `admin-token.ts` on the device route (and send the header from `device-push.ts`).

### C5. Lost-update race in fleet persistence
`updateDevice` ([fleet-store.ts:59-91](../../../server/fleet-store.ts)) is read→modify→write with only the final write serialized. Two overlapping mutations (playlist reorder + settings PATCH; or startup migration + early PATCH after a deploy restart) silently drop one of the writes while both respond 200.
**Fix:** extend `writeLock` to cover the whole read-modify-write, or funnel mutations through a single queue.

### C6. GitHub PAT is baked into the public kiosk bundle
[GithubApp.tsx:59](../../../src/apps/github/GithubApp.tsx) inlines `VITE_GITHUB_TOKEN` into `dist/assets/*.js`, served to anyone on the LAN. (Current token is already dead — but the *architecture* is the defect, and it's also why every token rotation needs a rebuild+redeploy.)
**Fix:** server-side `/api/github` proxy, same pattern as the existing calendar/claude-usage proxies. Token becomes a server env var; rotation = restart, no rebuild.

---

## Important — systemic issues

### I1. The admin writes config the kiosk never reads (dead-knob epidemic)
Verified by grep: only `ClockApp` consumes `props.config`, and only `faceId`.
- `enabledApps` (Apps toggles) — saved, pushed, read by nothing; every app always shows.
- `config.face` options (8 zod schemas, ~305 LOC) + complication slot layout — full editing UI in `FaceConfig.tsx`, rendered nowhere (AnalogClock hardcodes its `#FFD700` accent; complication renderers never mount).
- Per-app settings (weather location/unit/forecastDays etc.) — forms exist; `WeatherApp` reads env only.
Every hour invested in the admin depreciates until the kiosk consumes what it saves — and users lose trust when knobs do nothing.

### I2. App/schema registry fragmentation is already shipping a defect
The app list lives in 4+ places that already disagree: `claude-usage` is registered on the kiosk and has a schema, but is missing from `ALL_KIOSK_APP_IDS`/`APP_DESCRIPTORS` ([capabilities.ts:19-44](../../../src/shared/capabilities.ts)) → invisible and unconfigurable in the admin. Schema resolution has three competing mechanisms (`configSchemaId` in capabilities — never populated; hardcoded `` `app.${appId}` `` in AppDetail; per-app metadata read by nothing). `supportsInternalSwipe`/`onSwipeOut` are confirmed-dead API declared in all 11 manifests.

### I3. Deploy payload is still a hand-maintained list; the next outage is pre-wired
`deploy.sh:24-42` must track the server's import graph by hand (the `src/shared/` incident class). Already visible next holes: `server/handlers.ts` imports from `src/api/` (type-only today — breaks the day it becomes a value import), and `config/fleet.example.json` is never shipped. `setup-pi.sh:95` still documents the pre-#20 broken payload.
**Fix that erases the class:** esbuild-bundle the server → payload collapses to `dist/ + package*.json + scripts/`, and tsx-in-production goes away too.

### I4. Failed config pushes to remote devices are never retried
Remote kiosks poll *their own* server, so `pushToDevice` is the only propagation path; on failure the device is marked `pending: true` and nothing ever drains it ([device-push.ts](../../../server/device-push.ts)). Also: hardcoded `:3000` ignores the `PORT` override; PATCHing read-only `superclock-slow` is accepted then permanently diverges.

### I5. Offline shows fabricated data with no tell
- Weather: any fetch failure renders hardcoded fake weather (30°, sunny, fake 3-day forecast) indistinguishable from live.
- GitHub: the 30-min refresh swallows errors, so after one success the "offline" tell never appears — silently weeks-stale (this exact failure mode is in the project's memory notes).
- ComplicationsLight/Dark render hardcoded fake complication values (caffeine, 42°C, 65% ring) as if live.

### I6. Silent-failure hotspots in ops plumbing
- `admin-token.ts` caches `null` on *any* read error → a root-owned `admin.json` silently disables auth for the whole `/api/admin/*` surface until restart+fix.
- `kiosk.sh` gives up after ~2-4 min of failed health probes and execs Chromium anyway → connection-refused error page until the 6h reload cycle.
- `resolve-device.ts` falls back to `'superclock-fast'` — a renamed/freshly-imaged Pi silently *becomes* fastclock (wrong config, wrong health identity). `setup-pi.sh` never seeds `DEVICE_ID`.
- Unmatched `/api/*` paths fall through to the SPA fallback → `200 text/html` instead of 404, producing misleading `Unexpected token '<'` errors.

### I7. CLAUDE.md actively mis-instructs agents
Four material lies in a repo developed mostly by agents: "no API routes" (there are ~1,200 LOC of them), "no router" (react-router-dom 7 drives the whole admin), the gesture/`supportsInternalSwipe` contract (real mechanism is the vertical-swipe callback), "Raspberry Pi 4" (fastclock is a Pi 5). Deploy payload list, `AppProps`, TanStack claims also stale. docs/admin/foundation.md's auth claim is contradicted by code (see C4).

---

## Gesture & perf nits (kiosk-feel issues)

- **Habits swipe leaks to shell:** stops **touch** events, shell listens to **pointer** events — swipe-down in monthly view also opens the app grid ([HabitsApp.tsx:212-225](../../../src/apps/habits/HabitsApp.tsx)).
- **Pinch misfires after first use:** cumulative `offset` persists across gestures ([useGestures.ts:87-93](../../../src/core/hooks/useGestures.ts)) — after one pinch-in, any later pinch instantly triggers `showGrid()`.
- **Grid overlay doesn't deactivate the app under it:** `isActive={true}` hardcoded — Fireplace's rAF particle sim burns Pi CPU behind an opaque overlay.
- **WorldClock constructs 5 `Intl.DateTimeFormat` per second** (ms-each on a Pi); WeatherApp re-renders everything every second for an HH:MM display.
- **Habits date math:** UTC `toISOString()` keys vs local-midnight keys → off-by-one day cells in UTC+ zones; frozen `now` means after midnight taps write "today" while the view checks "yesterday".
- Debug `#gesture-debug` overlay ships to production; AppGrid pan has no bounds clamping (draggable fully off-screen); photo-frame fades to black instead of crossfading and doesn't preload; Pomodoro state dies on any swipe/rotation; playlist rotation-seconds input PATCHes on every keystroke; stale `instances` closure in `playlist.ts` can navigate to deleted instances.

---

## Testing gap — first five tests by safety-per-hour

1. **`src/shared/time-window.ts`** — feeds both night theming and physical panel power; ~10 table cases, pure, one hour.
2. **`server/fleet-store.ts`** — upsert semantics, version bump, migration idempotency + `updatedAt` stamping (poll cache keys on it); documents the C5 race.
3. **Registry coherence test** — assert schema-registry ⇄ face-registry ⇄ capabilities ⇄ `src/apps/index.ts` ⇄ `FACE_COMPONENTS` agree. **Would fail twice today** (claude-usage; minimalismo schema).
4. **`server/handlers.ts` calendar** — rrule expansion, horizons, all-day detection; timezone-sensitive, fixture-driven.
5. **`server/admin-routes.ts` via supertest** — shallow-merge PATCH semantics, instance CRUD/playlist cleanup, auth pass-through when token file missing.

Vitest, zero mocks needed for 1-3.

---

## What's genuinely solid

`useClockHands` + its ESLint enforcement (the one refactor that fully landed — 8/8 faces); `local-config.ts`'s `useSyncExternalStore` + localStorage resilience; `apply-settings.ts`'s external-store night flag; atomic tmp+rename fleet writes; `timingSafeEqual` token auth; display-adapter's never-throw discipline; claude-usage proxy's single-flight dedup; setup-pi.sh idempotency; deploy.sh's rsync→restart ordering; Express 5 turning async handler errors into 500s not crashes; every interval/listener has a cleanup path (two trivial `setTimeout`s excepted).

---

## Recommended order of attack

1. **Critical-bug batch** (C1–C6): one focused PR-per-cluster — kiosk wedge (C1), fleet-store hardening (C2+C5), display-adapter boot (C3, + merge PR #21), device-route auth+validation (C4), GitHub proxy (C6). Each is small and independently shippable.
2. **Bootstrap Vitest** with tests 1–3 above (the coherence test immediately pins I2 and catches every future registry drift).
3. **Wire the admin→kiosk config pipeline** (I1+I2): smallest slice first — `enabledApps` into `initApps()`, AnalogClock accent from `config.face`, add claude-usage to capabilities, delete the two dead schema-resolution mechanisms and `supportsInternalSwipe`.
4. **Bundle the server with esbuild** (I3) — erases the deploy-payload failure class and the tsx production dependency.
5. **Rewrite CLAUDE.md + foundation.md** to match reality (I7) — cheapest item, de-risks every future agent session.
6. **Honest-offline pass** (I5) + gesture/perf nits, opportunistically.
7. **Decide the React↔LVGL parity strategy** (shared JSON face-spec vs documented manual checklist) *before* PRs #23/#24 merge make it three-of-N faces.

Open PRs, for the record: #23/#24 (slow-native) are mergeable; #12 (quote app) is 2 months stale and conflicting — rebase or close.
