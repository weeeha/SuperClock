# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project context

SuperClock is a smart-clock dashboard for a fleet of four Raspberry Pis driving Waveshare round/square LCDs. Per-device hardware specs live in `superclock-{fast,small,square,slow}/device.json` (fast is a Pi 5; the others are Pi 4-class; `slow` runs a separate native LVGL binary — not Chromium). The UI is laid out for a circular 1080×1080 viewport on the round devices, so most full-screen surfaces assume a 1:1 aspect ratio. Two SPAs ship from one Vite build: the **kiosk** (`index.html`, full-screen touch UI) and the **admin** (`admin/index.html`, fleet management at `/admin`), both served by the bundled Express server on every Pi.

## Commands

```bash
npm run dev        # Vite dev server with HMR (port 5180 via .claude/launch.json); /api/* served in-process
npm run build      # tsc -b + vite build (kiosk + admin) + esbuild server bundle → dist/ (incl. dist/server.mjs)
npm run start      # node dist/server.mjs — production server (build first), listens on 0.0.0.0:$PORT (default 3000)
npm run start:src  # tsx server.ts — run the server from source without building
npm run lint       # ESLint over **/*.{ts,tsx}
npm test           # Vitest — time-window, fleet-store, registry coherence + contract, navigation invariants
npm run check:tokens        # token gate: semantic-only zones + face --face-* rule (scripts/check-tokens.mjs)
npm run new:app -- <id>     # scaffold a kiosk app across every registry touchpoint, red-by-construction
npm run new:face -- <id>    # scaffold a clock face likewise (born consuming --face-*)
./scripts/gates.sh          # the local CI mirror — lint → check:tokens → test → build, in ci.yml's order
```

The **registry coherence test** (`src/shared/registry-coherence.test.ts`) pins the app/face/schema registries together — if you add an app or face and `npm test` fails, it is telling you which list you forgot (see Conventions). Its sibling `registry-contract.test.ts` catches what coherence can't: files that reached NO registry (a forgotten side-import, an unregistered schema file, missing preview art). Prefer the scaffolders — they emit every touchpoint at once plus a todo test that stays red until the component is implemented.

### Pi deployment

`scripts/deploy.sh nickv2026@<pi-ip>` builds locally and rsyncs the runtime payload to `~/SuperClock` on the Pi: `dist/` (client + `server.mjs` + `build-info.json`), `package*.json`, `config/fleet.example.json`, `scripts/`. The server is a self-contained esbuild bundle, so there is **no list of server source dirs to maintain** — npm packages stay external and are installed on the Pi (`npm ci --omit=dev`). `config/fleet.json` and `config/admin.json` are device-local state, never synced. The deploy script restarts the server (systemd brings it back) so fleet migrations run immediately.

Deploys are **guarded and self-verifying**: the script refuses a dirty tree or a HEAD that isn't origin/main (`DEPLOY_ANYWAY=1` overrides — that's the blessed path for branch test builds on fastclock), refuses a device without 3× payload free space, and after restarting polls `/api/health` until the reported `build.commit` equals the commit it shipped — so "which commit is this device running?" is answered by `curl <pi>:3000/api/health`, never by `dist/` mtimes (rsync preserves them; they lie).

First-time provisioning uses `scripts/setup-pi.sh` (run as root on Pi OS Trixie): installs Node + npm via `apt-get`, runs `npm ci --omit=dev`, and installs **one** systemd unit — `superclock-server.service` (`ExecStart=npm run start`, `WorkingDirectory=~/SuperClock`). **Naming drift on the live fleet:** devices provisioned before that unit existed run the server as `superclock.service` (verified on fastclock 2026-08-07) — a fresh provision creates the new name, so use `systemctl status 'superclock*'` when inspecting; deploy.sh's pkill-based restart works for either. The Chromium kiosk is **not** a systemd service: `scripts/kiosk.sh` is wired into `~/.config/labwc/autostart`, waits for `/api/health`, and execs Chromium with the required Wayland flags. `setup-pi.sh` is idempotent; `SERVICE_USER`/`REPO_DIR`/`PORT`/`ADMIN_HOST` are env-overridable. Server-side secrets (`CALENDAR_ICS_URL`, `GITHUB_TOKEN`) go in `/etc/default/superclock` on the Pi or `.env` in dev.

## Architecture

### Two SPAs, one server

- **Kiosk** (`src/` root, `src/apps/`, `src/core/`): store-driven, **no router** — do not introduce react-router here.
- **Admin** (`src/admin/`): react-router 7 + TanStack Query + shadcn-style components scoped under `.admin-root`. Served at `/admin` (only meaningful on the admin host).
- **Server** (`server.ts` + `server/`): Express 5. Real API surface — `/api/health`, `/api/calendar`, `/api/photos`, `/api/claude-usage` and `/api/github/contributions` (server-side proxies; secrets never reach the browser), `/api/device/*` (capabilities/state/config; config POST is zod-validated and optionally token-gated), `/api/admin/*` (fleet CRUD behind bearer/cookie auth, admin host only). Unmatched `/api/*` 404s as JSON before the SPA fallbacks. The same API app is mounted into Vite in dev (`vite.config.ts`).

### Fleet config pipeline (admin → kiosk)

`config/fleet.json` on the admin host is the source of truth (`server/fleet-store.ts`: atomic fsync'd writes, corrupt-file quarantine, serialized read-modify-write). Admin mutations validate against `src/shared/device-config-schema.ts` (zod), persist, then push to the target device's `POST /api/device/config` (failed pushes retry every 60s). Each kiosk polls its own `GET /api/device/config` every 5s with a localStorage last-good cache (`src/shared/local-config.ts`). The kiosk **consumes** this config: `enabledApps` filters the swipe order (empty = all), playlist auto-rotation drives `switchToInstance`, `settings` feeds theme/night/brightness (`src/core/apply-settings.ts`), and clock instances receive `faceId` + merged `face` options (see `ClockApp.tsx` → `FaceProps.faceConfig`; `AnalogClock` is the reference consumer).

### App registry + lazy loading

Every mini-app is a module under `src/apps/<name>/` with an `index.ts` calling `registerApp({ metadata, component: lazy(...) })` and a `<Name>App.tsx` default-exporting a component receiving `AppProps` (`{ isActive, config? }`). **Adding a new app requires:** the side-import in `src/apps/index.ts`, an entry in `ALL_KIOSK_APP_IDS` in `src/shared/capabilities.ts`, and (unless it's config-free) an `app.<id>` schema in `src/shared/schemas/` + `src/shared/schema-registry.ts`. `npm test` fails until all lists agree. Faces additionally need: component + `FACE_COMPONENTS`/`SWIPE_CYCLE_ORDER` in `src/apps/clock/face-components.ts`, a `face-registry.ts` entry, and a `face.<id>` schema. **Don't hand-assemble these** — `npm run new:app -- <id>` / `npm run new:face -- <id>` emit every touchpoint (transactionally: a drifted anchor or duplicate id aborts with nothing written) plus a failing todo test; implementing the component and deleting that test is the definition of done.

### Navigation state (Zustand)

`src/core/navigation.ts` is the single source of truth: `mode: 'app' | 'grid' | 'transitioning'`, `activeAppId`, `activeInstanceId`. `SwipeContainer` keys its AnimatePresence child on `activeInstanceId ?? activeAppId` — **every action that sets `mode: 'transitioning'` must change that key**, or `onExitComplete → finishTransition()` never fires and all gestures die (they gate on mode). This invariant is pinned by `src/core/navigation.test.ts`. The store is `window.__nav` in dev. The same store also carries the overlay/back-gesture state consumed by Gestures below (`settingsOpen`, `peek`, `backCallback`) — none of it participates in the mode/transitioning contract above.

### Gestures

Classification is split into two pure, unit-tested functions; `src/core/hooks/useGestures.ts` is a thin dispatcher over them — one root `@use-gesture/react` handler (pointer events, pointer capture — no per-app gesture handlers). `src/core/gesture-zones.ts` classifies the touch **origin** at `onDragStart` — disc center + radius/angle math, not a y-coordinate check — into `inner | top-arc | bottom-arc | left-arc | right-arc` (a ~70px-equivalent outer ring, `RING_FRACTION`, tuned on hardware). `src/core/gesture-resolve.ts` takes that zone plus live nav state at drag end and returns exactly one `DragAction` tag; the handler only dispatches.

Arc map (app mode): **top-arc swipe down → grid**; **bottom-arc swipe up → quick-settings**, with peek-follow (`nav.peek` tracks the finger) and commit at `COMMIT_PROGRESS` (40% of sheet height, min `ARC_MIN_TRAVEL` 80px); **left-arc swipe right → back**, dispatched through registerable `backCallback` (Calendar is the reference consumer; `BackChevron` is deleted — apps never render their own back chrome); **right-arc is unassigned**, falls through to inner behavior. **An assigned-arc origin owns its gesture**: sub-threshold travel is a snap-back no-op, it never falls through to the app gesture underneath — one gesture, one outcome. Unclaimed inner-disc vertical swipe (no `verticalSwipeCallback` registered) is a **strict no-op**, there is no grid fallback anymore. 3-finger tap and pinch-in are unchanged and still open the grid (pinch-in kept deliberately as a redundant entry point alongside the top-arc swipe).

`backCallback` follows the **same registration/cleanup contract as `verticalSwipeCallback`** below — copy it exactly, including the guarded cleanup.

`settingsOpen` is a boolean **flag**, deliberately not a `NavMode`: mutually exclusive with `grid`, but it must never touch the `mode: 'transitioning'` contract above (opening/closing the sheet can't strand a swipe transition). Its brightness/night writes go through `src/core/local-overrides.ts`, which yields to the admin/scheduled base: an override wins only until the base it was set against changes, then it's silently spent. `src/core/hooks/useIdleReturn.ts` dismisses overlays after 20s idle and returns to the home app after 5min, **deferring only the home-return** (not overlay dismissal) while `isPlaylistDriving()`.

**Vertical-swipe view cycling is the blessed multi-view pattern** (decided 2026-07-24): an app with more than one view registers the callback and cycles views on swipe up/down, sacrificing swipe-down-to-grid (the grid stays reachable via 3-finger tap / pinch-in; by convention swipe-down at the app's view 0 still falls through to `showGrid()`). HabitsApp is the reference implementation — copy its registration/cleanup shape exactly, **including the guarded cleanup**: capture the callback in a const and only null the store slot if `useNavigation.getState().verticalSwipeCallback === cb` (SwipeContainer's `popLayout` keeps the exiting app mounted after the next app registers, so an unconditional null in unmount cleanup stomps the incoming app's registration). Users: ClockApp (faces), Habits, Fitness, Time tracker, GitHub, Claude usage, Calendar. Multi-view apps show Habits-style pager dots.

### Conventions

- **Active-aware effects:** gate `setInterval`/rAF on `props.isActive` — background apps must not tick (the grid overlay deactivates the app under it). Kiosks run for weeks; leaked timers and per-second re-renders are real heat on a Pi.
- **Clock hands:** `useClockHands` is the single source of truth for hand angles; ESLint bans `setInterval` in `src/apps/clock/`.
- **Honest offline:** apps that fetch must show an explicit offline tell (see WeatherApp/GithubApp) — never render fallback/mock data as if live.
- **Secrets are server-side.** `VITE_`-prefixed env vars are inlined into the public bundle — never put a token in one; add a server proxy route instead (github/claude-usage pattern).
- **Tailwind v4** via `@tailwindcss/vite`; kiosk theme tokens live in `src/index.css` under `@theme` (admin tokens separately in `src/admin/index.css`). No `tailwind.config.*`.
- **TypeScript:** `verbatimModuleSyntax` + `erasableSyntaxOnly` (type-only imports must use `import type`; no enums), `noUnusedLocals`/`noUnusedParameters` on.
- **Static assets** are hashed PNG/SVG files in `public/` referenced by absolute path — the grid map in `AppGrid.tsx` and face previews in `face-registry.ts` point at them; don't rename without updating both.
- **Touch/scroll is locked globally** in `src/index.css`; anything scrollable inside an app opts back in locally.

### React ↔ LVGL face parity

The `slow` device renders faces natively (LVGL, C — `slow-native/`, PRs #23/#24). Any face that exists on both sides (currently Minimalismo) has **two implementations kept in sync by hand**: if you change a shared face's geometry, palette, or night behavior in React, update `slow-native/src/clock_face.c` in the same PR or file a follow-up. Longer term the intent is a shared JSON face-spec (colors, hand geometry, tick layout — the same data `face.*` schemas and `handPoints` already encode) consumed by both renderers; until that exists, treat visual parity as part of face-change review.

## Traps already paid for

Each of these cost a debugging session once. Don't pay again.

- **Local main lags origin/main while `deploy.sh` ships LOCAL state** — the recurring "my fix didn't stick" failure. The SessionStart hook prints the drift; `git pull` main before any deploy. Never trust `dist/` mtimes either (rsync preserves them — `/api/health`'s build stamp is the truth).
- **Fresh worktrees start without `node_modules`** — run `npm ci` before tests or build. The SessionStart hook warns.
- **This checkout path contains spaces** (`ClaudeCode Projects`). Quote every shell path; in node scripts use `fileURLToPath(import.meta.url)`, never `URL.pathname`.
- **Issue refs like `#1234` parse as hex** in the token gate — write `GH-1234` in gated sources.
- **ESLint runs the full react-hooks v7 Compiler ruleset** — hooks fixes must satisfy it, not just the classic two rules.
- **An unconditional cleanup that nulls a shared nav-store slot stomps the incoming app's registration** (SwipeContainer's `popLayout` keeps the exiting app mounted) — copy HabitsApp's guarded cleanup exactly.

## Known gaps — port, don't reinvent

- **No Storybook / a11y-contrast gate.** Contrast is checked by eye. The proven pattern (every story an axe test in real Chromium — jsdom silently skips `color-contrast`) lives in the sibling `Minimal-Design-System` repo; port it, don't rebuild it.
- **The one-accent-quantity rule and LVGL parity are review-enforced, not gated.** The planned fix is the shared JSON face-spec above.
- **Seven legacy faces are exempt from the `--face-*` night rule** (`FACE_TOKEN_EXEMPT` in `scripts/lib/token-rules.mjs`). The list may only shrink: retrofit a face, delete its line.
- **The unslop skill's Phase 2 greps are run by hand** (`.claude/skills/unslop/SKILL.md`); only the token-gate slice is scripted.

## Open decisions — flag, don't silently pick

Resolving any of these to make a gate or review pass is not yours to do. Propose with evidence and wait.

- **Two default oranges coexist**: the kiosk CSS fallback `--color-accent: #ff8826` (src/index.css) vs the config default `DEFAULT_ACCENT = '#ff6b35'` (src/shared/types.ts, applied once config arrives). Unifying them changes on-glass color — it is a design decision, not a cleanup.
- **The admin styles semantic colors via arbitrary values** (`text-[hsl(var(--success))]`) because `src/admin/index.css` has no `@theme` block. Moving to real utilities is open; don't drift the file into a mix of both idioms.
- **Do not quietly change a face's palette or geometry to turn a check green** (contrast, parity, token gate). The face's look is the product; a red check on a deliberate design is a conversation, not a fix-forward.
