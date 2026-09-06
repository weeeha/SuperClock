# SuperClock

A round-display smart clock dashboard for a custom Raspberry Pi fleet. SuperClock bundles a set of mini-apps (clock, weather, calendar, fitness, GitHub stats, habits, fireplace, photo frame, quotes, time tracking, Claude usage) into a single full-screen interface designed for a 1080×1080 circular LCD, plus a fleet admin panel served at `/admin` on the admin host.

## Hardware

- **SBC:** Raspberry Pi 4/5 (per device — see `superclock-*/device.json`)
- **Display:** Waveshare 5-inch 1080×1080 round LCD
- **HAT:** SunFounder Fusion HAT
- **Form factor:** Round, 1080×1080 — UI is laid out for a circular viewport

## Built-in apps

`src/apps/`, one directory per app (this list is pinned to the registry by `scripts/lib/docs-drift.test.ts`):

- `agents` — chat with your life-OS agents (mock provider today)
- `breathing` — respiration rate from the A121 mmWave radar
- `calendar` — today's date and upcoming events from an iCal feed
- `claude-usage` — session and weekly Claude Code rate-limit utilization, with the Clawd sprite
- `clock` — watch faces (13 today), swipe to cycle
- `fireplace` — ambient fireplace animation
- `fitness` — 7-minute workout circuits with a guided timer
- `github` — GitHub contribution heatmap as a radial watch face
- `habits` — daily habit tracker with streaks
- `photo-frame` — photo slideshow
- `quote` — quote of the day
- `time-tracking` — pomodoro focus timer
- `todo` — one flat list: tap to complete, swipe up for done
- `weather` — current conditions and forecast

## Tech stack

- React 19 + TypeScript + Vite 8
- Tailwind CSS v4
- Zustand (state) + TanStack Query (data)
- Framer Motion (animation) + `@use-gesture/react` (gestures)
- Express server (`server.ts`) for production hosting on the Pi

## Scripts

```bash
npm run dev       # Vite dev server with HMR
npm run build     # type-check + production build
npm run start     # serve the built app via Express
npm run preview   # preview the production build
npm run lint      # ESLint
npm test          # Vitest (registry, schema, capability and docs gates included)
./scripts/gates.sh # the local CI mirror: lint, token gate, tests, build
```

Architecture, fleet deployment and the house rules live in [AGENTS.md](AGENTS.md); the admin panel at `/admin` and the fleet config pipeline are described there.

## Quickstart

```bash
npm install
cp .env.example .env   # then fill in the values you care about
npm run dev
```

For deployment on the Pi:

```bash
npm run build
npm run start
```

## Configuration

All config lives in `.env` (see `.env.example`). Variables prefixed `VITE_` are exposed to the browser; the rest are server-only.

| Variable | Used by | Notes |
|---|---|---|
| `GITHUB_TOKEN` | GitHub app | PAT with `read:user`. Server-only: the kiosk calls the `/api/github/contributions` proxy, so the token never reaches the browser and rotating it is a service restart, not a rebuild. Unset shows an honest "not connected" state. |
| `VITE_WEATHER_LAT`, `VITE_WEATHER_LON` | Weather app | Open-Meteo lat/lon. No API key needed. Used only when the instance's `location` is blank. |
| `VITE_WEATHER_TZ` | Weather app | IANA tz, defaults to `auto`. |
| `VITE_WEATHER_UNIT` | Weather app | `fahrenheit` to switch units; anything else = celsius. Used only when the instance's `unit` was never set. |
| `CALENDAR_ICS_URL` | Calendar app | Any iCal URL (Google Calendar secret address, iCloud, Outlook). Read server-side; the browser only sees the parsed event list. |

### Photos

Drop photos into `public/photos/*.{jpg,jpeg,png,webp}`. They're served at `/photos/<file>` and cycled by the photo-frame app every 8 seconds. The directory is gitignored (only `.gitkeep` is tracked). Vite copies the contents into `dist/photos/` at build time.

### Production env

`npm run start` loads `.env` automatically (Node `--env-file-if-exists`). On the Pi, make sure `.env` is present alongside `server.ts` — or export the variables in your shell / systemd unit before launching.
