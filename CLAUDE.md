# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project context

SuperClock is a smart-clock dashboard that runs full-screen on a Raspberry Pi 4 driving a Waveshare 1080×1080 round LCD. Per-device hardware specs live in `superclock-{fast,small,square,slow}/device.json`. The UI is laid out for a circular viewport on the round devices, so most full-screen surfaces assume a 1:1 aspect ratio and may apply a circular clip-path (see `AppGrid.tsx`). It is a single-page React app served by the bundled Express server (`server.ts`) on every Pi. (The `slow` device runs a separate native LVGL binary — not Chromium.)

## Commands

```bash
npm run dev       # Vite dev server with HMR (port 5173, --host via .claude/launch.json)
npm run build     # tsc -b (project references) + vite build → dist/
npm run start     # node --import tsx server.ts — Express, serves dist/, listens on 0.0.0.0:$PORT (default 3000)
npm run preview   # Vite preview of the production build
npm run lint      # ESLint over **/*.{ts,tsx}
```

There is no test runner configured.

### Pi deployment

`scripts/deploy.sh nickv2026@<pi-ip>` builds locally and rsyncs the runtime payload (`dist/`, `server.ts`, `server/`, `package*.json`, `tsconfig*.json`, `scripts/`) to `~/SuperClock` on the Pi. First-time provisioning uses `scripts/setup-pi.sh` (run as root on Pi OS Trixie): it installs Node 20 + npm 9 via `apt-get`, runs `npm ci --omit=dev`, and installs **one** systemd unit — `superclock-server.service` (user `nickv2026`, `WorkingDirectory=/home/nickv2026/SuperClock`, runs the Express server on `:3000`). The Chromium kiosk is **not** a systemd service: `setup-pi.sh` wires `scripts/kiosk.sh` into `~/.config/labwc/autostart`, which waits for `/api/health` and execs Chromium with the required Wayland/keyring flags (`--ozone-platform=wayland --password-store=basic --use-mock-keychain`). `setup-pi.sh` is idempotent; `SERVICE_USER`/`REPO_DIR`/`PORT`/`ADMIN_HOST` are env-overridable.

## Architecture

### App registry + lazy loading

Every "mini-app" is a self-contained module under `src/apps/<name>/` with two required files:

- `index.ts` — calls `registerApp({ metadata, component: lazy(() => import('./<Name>App')) })` from `src/core/registry.ts`. The registry is a plain `Map` keyed by `metadata.id`.
- `<Name>App.tsx` — default export is a component receiving `AppProps` (`{ isActive, onSwipeOut? }`) defined in `src/core/types.ts`.

`src/apps/index.ts` side-imports each app folder so registration happens at module load. **Adding a new app means adding an entry there** — otherwise it never registers and never appears in `appOrder`.

Apps are code-split: each is wrapped in `React.lazy` and rendered inside a `<Suspense>` boundary in `SwipeContainer.tsx`.

### Navigation state (Zustand)

`src/core/navigation.ts` is the single source of truth for what's on screen:

- `mode: 'app' | 'grid' | 'transitioning'` — `app` shows the active app full-screen; `grid` overlays the launcher; `transitioning` is set briefly while Framer Motion swaps app components, then `finishTransition()` (called from `SwipeContainer`'s `onExitComplete`) resets to `'app'`.
- `appOrder` is populated from `getAppIds()` on mount via `initApps()` in `App.tsx`. Order in `src/apps/index.ts` determines swipe order.
- The store is exposed as `window.__nav` in dev for quick poking.

### Gestures → navigation

`src/core/hooks/useGestures.ts` attaches a single `@use-gesture/react` drag handler to the root container:

- Vertical swipe down from `app` → `showGrid()`; vertical swipe up from `grid` → `hideGrid()`.
- Horizontal swipe in `app` mode → `swipeToNext` / `swipeToPrev`.
- Thresholds: `SWIPE_THRESHOLD = 50px`, `SWIPE_VELOCITY = 0.3`. Drags below either are ignored.

Apps that want to consume horizontal swipes themselves (e.g. `ClockApp` cycling through watch faces) set `metadata.supportsInternalSwipe: true` and call `props.onSwipeOut?.(direction)` when their internal sequence is exhausted, letting the shell take over. Note: as of this writing the shell's `useAppGestures` always runs at the root and doesn't yet read `supportsInternalSwipe` — internal-swipe apps need to handle their own gestures and stop propagation, or this needs to be wired through.

### Rendering pipeline

`App.tsx` renders `<SwipeContainer />` (the active app) plus an `<AnimatePresence>` for `<AppGrid />` when `mode === 'grid'`. `SwipeContainer` uses Framer Motion variants keyed on `activeAppId` to slide apps in/out; direction comes from the store's `transitionDirection`.

### Conventions

- **Active-aware effects:** components should gate `setInterval` / animation loops on `props.isActive` so background apps don't keep ticking. `AnalogClock.tsx` is the canonical pattern.
- **Tailwind v4** via the `@tailwindcss/vite` plugin; theme tokens (`--color-accent`, `--color-temp-high/low`, `--font-family-display`) live in `src/index.css` under `@theme`. There is no `tailwind.config.*`.
- **TypeScript** uses `verbatimModuleSyntax` and `erasableSyntaxOnly` — type-only imports must use `import type`, and enums/namespaces are disallowed. `noUnusedLocals` / `noUnusedParameters` are on, so dead args break the build.
- **Static assets** are hashed PNG/SVG files in `public/` referenced by absolute path (`/<hash>.png`) — chiefly the Figma-exported face thumbnails wired up in `AppGrid.tsx`. Don't rename these without updating the grid map.
- **No router.** Navigation is entirely store-driven; do not introduce `react-router` for in-app screens.
- **Touch/scroll is locked globally** in `src/index.css` (`touch-action: none`, `user-select: none`, scrollbars hidden). Anything scrollable inside an app needs to opt back in locally.

### Server

`server.ts` (run via `tsx`) is intentionally minimal: long-cache `/assets/*`, static `dist/`, SPA fallback (`/{*splat}` → `index.html`), and logs the LAN IP for kiosk wiring. No API routes — all data fetching happens client-side (TanStack Query is available but not yet wired into shared providers).
