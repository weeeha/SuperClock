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
npm run dev
```

For deployment on the Pi:

```bash
npm run build
npm run start
```
