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
npm test           # Vitest — time-window, fleet-store, registry coherence, navigation invariants
```

The **registry coherence test** (`src/shared/registry-coherence.test.ts`) pins the app/face/schema registries together — if you add an app or face and `npm test` fails, it is telling you which list you forgot (see Conventions).

### Pi deployment

`scripts/deploy.sh nickv2026@<pi-ip>` builds locally and rsyncs the runtime payload to `~/SuperClock` on the Pi: `dist/` (client + `server.mjs`), `package*.json`, `config/fleet.example.json`, `scripts/`. The server is a self-contained esbuild bundle, so there is **no list of server source dirs to maintain** — npm packages stay external and are installed on the Pi (`npm ci --omit=dev`). `config/fleet.json` and `config/admin.json` are device-local state, never synced. The deploy script restarts the server (systemd brings it back) so fleet migrations run immediately.

First-time provisioning uses `scripts/setup-pi.sh` (run as root on Pi OS Trixie): installs Node + npm via `apt-get`, runs `npm ci --omit=dev`, and installs **one** systemd unit — `superclock-server.service` (`ExecStart=npm run start`, `WorkingDirectory=~/SuperClock`). The Chromium kiosk is **not** a systemd service: `scripts/kiosk.sh` is wired into `~/.config/labwc/autostart`, waits for `/api/health`, and execs Chromium with the required Wayland flags. `setup-pi.sh` is idempotent; `SERVICE_USER`/`REPO_DIR`/`PORT`/`ADMIN_HOST` are env-overridable. Server-side secrets (`CALENDAR_ICS_URL`, `GITHUB_TOKEN`) go in `/etc/default/superclock` on the Pi or `.env` in dev.

## Architecture

### Two SPAs, one server

- **Kiosk** (`src/` root, `src/apps/`, `src/core/`): store-driven, **no router** — do not introduce react-router here.
- **Admin** (`src/admin/`): react-router 7 + TanStack Query + shadcn-style components scoped under `.admin-root`. Served at `/admin` (only meaningful on the admin host).
- **Server** (`server.ts` + `server/`): Express 5. Real API surface — `/api/health`, `/api/calendar`, `/api/photos`, `/api/claude-usage` and `/api/github/contributions` (server-side proxies; secrets never reach the browser), `/api/device/*` (capabilities/state/config; config POST is zod-validated and optionally token-gated), `/api/admin/*` (fleet CRUD behind bearer/cookie auth, admin host only). Unmatched `/api/*` 404s as JSON before the SPA fallbacks. The same API app is mounted into Vite in dev (`vite.config.ts`).

### Fleet config pipeline (admin → kiosk)

`config/fleet.json` on the admin host is the source of truth (`server/fleet-store.ts`: atomic fsync'd writes, corrupt-file quarantine, serialized read-modify-write). Admin mutations validate against `src/shared/device-config-schema.ts` (zod), persist, then push to the target device's `POST /api/device/config` (failed pushes retry every 60s). Each kiosk polls its own `GET /api/device/config` every 5s with a localStorage last-good cache (`src/shared/local-config.ts`). The kiosk **consumes** this config: `enabledApps` filters the swipe order (empty = all), playlist auto-rotation drives `switchToInstance`, `settings` feeds theme/night/brightness (`src/core/apply-settings.ts`), and clock instances receive `faceId` + merged `face` options (see `ClockApp.tsx` → `FaceProps.faceConfig`; `AnalogClock` is the reference consumer).

### App registry + lazy loading

Every mini-app is a module under `src/apps/<name>/` with an `index.ts` calling `registerApp({ metadata, component: lazy(...) })` and a `<Name>App.tsx` default-exporting a component receiving `AppProps` (`{ isActive, config? }`). **Adding a new app requires:** the side-import in `src/apps/index.ts`, an entry in `ALL_KIOSK_APP_IDS` in `src/shared/capabilities.ts`, and (unless it's config-free) an `app.<id>` schema in `src/shared/schemas/` + `src/shared/schema-registry.ts`. `npm test` fails until all lists agree. Faces additionally need: component + `FACE_COMPONENTS`/`SWIPE_CYCLE_ORDER` in `src/apps/clock/face-components.ts`, a `face-registry.ts` entry, and a `face.<id>` schema.

### Navigation state (Zustand)

`src/core/navigation.ts` is the single source of truth: `mode: 'app' | 'grid' | 'transitioning'`, `activeAppId`, `activeInstanceId`. `SwipeContainer` keys its AnimatePresence child on `activeInstanceId ?? activeAppId` — **every action that sets `mode: 'transitioning'` must change that key**, or `onExitComplete → finishTransition()` never fires and all gestures die (they gate on mode). This invariant is pinned by `src/core/navigation.test.ts`. The store is `window.__nav` in dev.

### Gestures

`src/core/hooks/useGestures.ts` attaches one `@use-gesture/react` handler at the root (pointer events, with pointer capture — child components cannot intercept via touch-event stopPropagation). Horizontal swipe switches apps; vertical swipe goes to the store's `verticalSwipeCallback` when an app registered one (ClockApp cycles faces, HabitsApp switches views), else swipe-down opens the grid; 3-finger tap and pinch-in also open the grid. Apps that want vertical swipes call `setVerticalSwipeCallback` while active — there is no metadata flag for this.

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
