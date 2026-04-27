# SuperClock

A round-display smart clock dashboard for a custom Raspberry Pi build. SuperClock bundles a set of mini-apps (clock, weather, calendar, fitness, GitHub stats, habits, fireplace, photo frame, quotes, time tracking) into a single full-screen interface designed for a 1080×1080 circular LCD.

## Hardware

- **SBC:** Raspberry Pi 4 Model B
- **Display:** Waveshare 5-inch 1080×1080 round LCD
- **HAT:** SunFounder Fusion HAT
- **Form factor:** Round, 1080×1080 — UI is laid out for a circular viewport

## Built-in apps

`src/apps/`:

- `clock` — primary time face
- `weather` — current conditions / forecast
- `calendar` — upcoming events
- `fitness` — activity rings / stats
- `github` — contributions and activity
- `habits` — daily habit tracking
- `fireplace` — ambient mode
- `photo-frame` — photo slideshow
- `quote` — rotating quotes
- `time-tracking` — focus / timer

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
```

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
| `VITE_GITHUB_TOKEN` | GitHub app | PAT with `read:user`. Falls back to mock data when unset. |
| `VITE_WEATHER_LAT`, `VITE_WEATHER_LON` | Weather app | Open-Meteo lat/lon. No API key needed. Falls back to mock when unset. |
| `VITE_WEATHER_TZ` | Weather app | IANA tz, defaults to `auto`. |
| `VITE_WEATHER_UNIT` | Weather app | `fahrenheit` to switch units; anything else = celsius. |
| `CALENDAR_ICS_URL` | Calendar app | Any iCal URL (Google Calendar secret address, iCloud, Outlook). Read server-side; the browser only sees the parsed event list. |

### Photos

Drop photos into `public/photos/*.{jpg,jpeg,png,webp}`. They're served at `/photos/<file>` and cycled by the photo-frame app every 8 seconds. The directory is gitignored (only `.gitkeep` is tracked). Vite copies the contents into `dist/photos/` at build time.

### Production env

`npm run start` loads `.env` automatically (Node `--env-file-if-exists`). On the Pi, make sure `.env` is present alongside `server.ts` — or export the variables in your shell / systemd unit before launching.
