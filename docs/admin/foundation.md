# SuperClock Admin — Foundation

Planning artifact. Captures the agreed shape of the admin panel before any UI/code work. Update as decisions change.

> **Status (2026-07-16):** largely implemented; CLAUDE.md describes the
> as-built system and is authoritative where the two disagree. Notable
> deltas from this plan: config writes are zod-validated on both admin and
> device routes (`src/shared/device-config-schema.ts`); device-side push
> auth is opt-in per device (see §Auth below); entry file is
> `admin/index.html`, not a repo-root `admin.html`; the unit is
> `superclock-server.service`; the server ships as an esbuild bundle
> (`dist/server.mjs`). Registry coherence is enforced by
> `src/shared/registry-coherence.test.ts`.

## Goals

- One web admin to manage the SuperClock fleet (Fast, Small, Square, Slow) from a phone or laptop on the LAN.
- Per-device configuration: which apps are enabled, configured instances of each, an ordered playlist, and device settings.
- Capability-driven UI: each device declares what it supports; the admin renders controls off that list. Slow Pi shows up with fewer toggles and no special-casing in JSX.
- Local-server first. Protocol is designed so a hosted relay (Vercel/Cloudflare) can swap in later without changing device code.

## Decisions locked

1. **Admin lives at `/admin`** on the same Express server the kiosk uses. Sibling route, not a separate port.
2. **Production runs Express only — nginx removed.** [scripts/setup-pi.sh](scripts/setup-pi.sh) currently provisions nginx on port 8080 serving static `dist/`. We replace that with the existing Express server (`npm run start`, the `superclock.service` unit), so admin/device routes share one origin with the kiosk.
3. **Slow Pi is read-only in v1, wire contract only.** Admin renders it with a "read-only" badge and hides write actions. The actual LVGL HTTP listener is *not in this repo's scope* — we publish the contract (capability JSON shape, endpoint paths) here; the binary lands in a separate slow-native repo/PR.
4. **Hostnames locked:** `superclock-fast`, `superclock-small`, `superclock-square`, `superclock-slow`. `DeviceId` enum mirrors these literally. The existing `superclock/device.json` and `square-superclock/device.json` get renamed/updated to match.
5. **Auth = LAN trust + shared bearer token.** No login screen. Token written during `setup-pi.sh`; admin reads it from `config/admin.json` and stamps every request.
6. **Fleet pattern follows TRMNL:** device selector top-right, per-device playlist, per-instance configuration. No fleet-wide playlist template in v1.
7. **Apps and watchfaces are flattened into one "screen" model.** A clock face is a playlist-eligible screen, equal in standing with a Habits screen or a Fitness screen.
8. **Watchfaces are a first-class subsystem inside Clock**, modeled on Apple Watch's iPhone app: three concepts — face type, face instance, complication — with a generic, schema-driven config UI. Complications are Clock-scoped in v1; the registry shape allows broadening to "any app exposes a complication view" later.
9. **shadcn is scoped under `<div class="admin-root">`** with its own `@theme` block in `src/admin/index.css`. Cannot touch the kiosk's tokens in [src/index.css](src/index.css).
10. **Kiosk last-good config cache = `localStorage`.** Key `superclock:device-config`. Written on every successful `GET /api/device/config`.

## Topology

```
   ┌────────────────────────┐        ┌──────────────────────┐
   │   fastclock (admin)    │        │   smallclock          │
   │  /            kiosk    │ POST   │  /          kiosk     │
   │  /admin       admin UI │ config │  /api/device          │
   │  /api/admin   fleet    │───────▶│                       │
   │  /api/device  self     │        └──────────────────────┘
   │                        │        ┌──────────────────────┐
   │  config/fleet.json     │        │   squareclock         │
   │  (source of truth)     │        │  /api/device          │
   └────────────────────────┘        └──────────────────────┘
                                     ┌──────────────────────┐
                                     │   slowclock (LVGL)    │
                                     │  /api/device (RO)     │
                                     └──────────────────────┘
```

`fastclock` is the admin host (matches the existing "default test device" memory). Every clock — including Slow — exposes a small device API. Admin reads/writes `config/fleet.json`, then pushes per-device config over the LAN. Each clock also pulls its own config on boot, so a clock that booted while admin was down still gets the last known state.

## URL surface

| Path             | Served by      | Purpose                            |
|------------------|----------------|------------------------------------|
| `/`              | every clock    | Kiosk SPA (existing)               |
| `/admin/*`       | admin Pi only  | Admin SPA                          |
| `/api/admin/*`   | admin Pi only  | Fleet CRUD + device push           |
| `/api/device/*`  | every clock    | Self capability, state, config     |
| `/api/health`    | every clock    | Existing — unchanged               |
| `/api/calendar`  | every clock    | Existing — unchanged               |
| `/api/photos`    | every clock    | Existing — unchanged               |

`/api/admin/*` is gated by an `ADMIN_HOST=true` env flag so only one Pi serves it. Default off.

## Type model (shared)

```ts
// src/shared/types.ts

export type DeviceId =
  | 'superclock-fast'
  | 'superclock-small'
  | 'superclock-square'
  | 'superclock-slow';
export type DeviceKind = 'kiosk' | 'lvgl';

export interface DeviceCapabilities {
  id: DeviceId;
  kind: DeviceKind;
  host: string;               // 'fastclock.local'
  readOnly: boolean;          // true for slowclock in v1
  apps: AppDescriptor[];
  features: FeatureFlag[];
}

export interface AppDescriptor {
  id: string;                 // 'clock', 'habits', 'fitness', ...
  configSchemaId?: string;    // resolved against src/shared/schemas/* on both ends
  faces?: FaceDescriptor[];   // only present for the Clock app
}

export interface FaceDescriptor {
  id: string;                 // 'minimalismo', 'analog', 'flip', 'infograph', ...
  name: string;               // 'Minimalismo'
  preview: string;            // public path to a thumbnail PNG
  category?: string;          // for the Face Gallery — 'tool', 'data-rich', etc.
  configSchemaId?: string;    // colors, dial variants, etc.
  slots: ComplicationSlot[];  // [] for faces with no complications
}

export interface ComplicationSlot {
  id: string;                 // 'topLeft', 'subDialRight', 'wideBottom'
  shape: ComplicationShape;
}

export type ComplicationShape = 'small' | 'circular' | 'wide';

export interface ComplicationDescriptor {
  id: string;                 // 'date', 'temperature', 'habit-streak', ...
  name: string;
  shapes: ComplicationShape[];   // which slot shapes this complication fits
  configSchemaId?: string;
}

export type FeatureFlag =
  | 'brightness'
  | 'sleep_schedule'
  | 'theme'
  | 'accent';

export interface ScreenInstance {
  id: string;                 // ULID
  appId: string;
  config: Record<string, unknown>;  // shape resolved via AppDescriptor.configSchemaId
  label?: string;             // user-provided override
}

// Shape of a Clock-app ScreenInstance.config:
//   {
//     faceId: 'infograph',
//     face: { color: 'black', dial: 'rectangle', ... },        // FaceDescriptor schema
//     complications: { topLeft: { id: 'date' }, topRight: { id: 'temperature' }, ... }
//   }

export interface DeviceConfig {
  deviceId: DeviceId;
  enabledApps: string[];
  instances: ScreenInstance[];
  playlist: {
    items: string[];          // ScreenInstance.id, ordered
    rotationSeconds: number | null;  // null = no auto-rotation
  };
  settings: {
    theme: 'light' | 'dark' | 'system';
    accent: string;           // hex
    brightness?: number;      // 0–100
    sleepSchedule?: { wake: string; sleep: string };  // 'HH:MM'
  };
  updatedAt: string;          // ISO
}

export interface FleetConfig {
  devices: DeviceConfig[];
  version: number;            // bumped on every write
}
```

## Watchfaces and complications

### Why a subsystem instead of a config blob

Each face has its own configurable surface: Minimalismo is one accent color; Infograph is one color plus seven complication slots; Unity Lights has color plus dial shape plus visual style. We need a generic config UI that adapts to each face. Two things make it tractable:

1. **Faces declare schemas, not UIs.** The admin renders forms generically from a face's `configSchemaId`. New faces don't need a new screen — just a new schema.
2. **Complications live in their own registry.** A face declares slots with shape constraints; complications declare which shapes they fit. The slot-picker only shows valid complications for that slot.

### Schemas on the wire

`configSchemaId` is a string ID — actual schemas live in `src/shared/schemas/` as zod modules imported by both admin and kiosk. Capabilities transmit IDs; both ends resolve them locally. Pro: zod types stay first-class on both sides. Con: admin and devices must run matching versions (acceptable — we deploy together).

### v1 registries (proposed)

**Faces** (existing kiosk components, retrofit gradually):
- `analog`, `complications-light`, `complications-dark`, `flip`, `floral`, `productivity`, `square`, `world`
- v1: stub all with `configSchemaId: undefined` and `slots: []`. Retrofit each as we touch it. (As built: every face except `minimalismo` now has a `face.*` schema; `analog` is the first face whose component consumes its config — accent, numerals, seconds.)

**Complications** (Clock-scoped in v1):
- `date` — today's day/month, small
- `temperature` — current temp + condition icon, small/circular
- `habit-streak` — current streak number + ring, circular
- `day-progress` — % of day elapsed as a bar/ring, circular/wide
- `fitness-ring` — activity rings, circular
- `next-calendar-event` — next event title + time, wide

Complication data comes from the same sources as the full apps — they're compact renderers over existing data, not new data pipelines.

### Admin navigation (Apple-derived)

```
Apps tab
  └─ [Clock app card]                   tap →
       ├─ My Faces                      list of face instances on this device
       │    ├─ [face row] tap →
       │    │    └─ Face Config         color/style + slot grid
       │    │         └─ [slot] tap →
       │    │              └─ Complication Picker
       │    └─ + Add Face tap →
       │         └─ Face Gallery        catalog of registered face types
       │              └─ [face card] tap → adds with defaults, opens config
       └─ App Settings                  Clock-app-level (default face, rotation, etc.)
```

Other apps (Habits, Fitness, GitHub, …) drill into a single config screen — they don't have the face/instance/slot layering.

### Future broadening (out of v1, but kept open)

The complication registry is independent of the Clock app. To let any app expose itself as a complication later, an app just exports `complications: ComplicationDescriptor[]` alongside its `metadata` in the existing `registerApp(...)` call. The admin already supports a generic registry — no schema change needed.

## API surface

### `/api/device/*` — mounted on every clock

| Method | Path                       | Returns                          |
|--------|----------------------------|----------------------------------|
| GET    | `/api/device/capabilities` | `DeviceCapabilities`             |
| GET    | `/api/device/state`        | `{ currentScreenId, uptimeMs, lastConfigAt }` |
| GET    | `/api/device/config`       | `DeviceConfig` (last applied)    |
| POST   | `/api/device/config`       | 200 \| 400; validates + applies  |

Slow Pi implements only the three GETs. `POST` returns 405.

### `/api/admin/*` — mounted on admin Pi only

| Method | Path                                                 | Body / Returns               |
|--------|------------------------------------------------------|------------------------------|
| GET    | `/api/admin/fleet`                                   | `FleetConfig`                |
| GET    | `/api/admin/fleet/:deviceId`                         | `DeviceConfig`               |
| PATCH  | `/api/admin/fleet/:deviceId`                         | partial `DeviceConfig` → 200 |
| POST   | `/api/admin/fleet/:deviceId/instances`               | `ScreenInstance`             |
| PATCH  | `/api/admin/fleet/:deviceId/instances/:id`           | partial → 200                |
| DELETE | `/api/admin/fleet/:deviceId/instances/:id`           | → 204                        |
| POST   | `/api/admin/fleet/:deviceId/playlist/reorder`        | `{ order: string[] }` → 200  |
| GET    | `/api/admin/health`                                  | `{ devices: [{id, reachable, lastSeen}] }` |

### Device push flow

When admin writes a `DeviceConfig`:

1. Validate against schema.
2. Persist to `config/fleet.json` (write-rename for atomicity).
3. `POST /api/device/config` to that device's `host`.
4. On 2xx → mark applied; on failure → mark pending, retry on the 30s reachability poll.

## File layout

```
src/
  admin/                         (new) admin SPA
    main.tsx                     separate Vite entry → dist/admin/index.html
    App.tsx                      router root
    routes/
      dashboard.tsx
      apps.tsx                   catalog + per-device enable
      apps.$appId.tsx            drill-down — for Clock, the My Faces screen
      apps.clock.faces.$instanceId.tsx   Face Config (color + slot grid)
      apps.clock.gallery.tsx     Face Gallery (catalog of face types)
      playlist.tsx               ordered list + drag-reorder
      settings.tsx               theme, brightness, schedule
    components/
      device-switcher.tsx        top-right selector
      app-card.tsx
      face-card.tsx              instance row in My Faces
      face-gallery-card.tsx      type card in Face Gallery
      face-config-form.tsx       generic, schema-driven
      slot-grid.tsx              the complication slot layout per face
      complication-picker.tsx    sheet/drawer with shape-filtered options
      playlist-row.tsx
      config-form.tsx            renders per AppDescriptor.configSchemaId
      ui/                        shadcn primitives
    lib/
      api.ts                     typed client for /api/admin
      query.ts                   tanstack-query setup (already a dep)
    store/
      active-device.ts           zustand
    index.css                    shadcn tokens, scoped to .admin-root
  apps/                          existing kiosk apps (unchanged)
  core/                          existing kiosk core (unchanged)
  shared/                        (new) cross-cutting code
    types.ts                     the type model above
    capabilities.ts              static capability declarations per device kind
    schemas/                     zod schemas keyed by configSchemaId
      face.minimalismo.ts
      face.infograph.ts          (etc — one per face that has config)
      complication.date.ts
      complication.temperature.ts (etc)
    face-registry.ts             all FaceDescriptors
    complication-registry.ts     all ComplicationDescriptors
  api/                           existing
server/                          existing
  handlers.ts                    existing
  admin-routes.ts                (new) Express router for /api/admin
  device-routes.ts               (new) Express router for /api/device
  fleet-store.ts                 (new) fs-backed CRUD on config/fleet.json
  device-push.ts                 (new) HTTP client to other Pis
server.ts                        existing — mount new routers
vite.config.ts                   add second entry; mirror device-routes in dev plugin
admin.html                       (new) admin entry HTML at repo root
index.html                       existing
config/
  fleet.example.json             checked in
  fleet.json                     gitignored, on admin Pi only
  admin.json                     gitignored, holds the bearer token
```

### Build

Vite's `rollupOptions.input` gets two entries:

```ts
build: {
  rollupOptions: {
    input: {
      kiosk: 'index.html',
      admin: 'admin.html',
    },
  },
}
```

Output: `dist/index.html` (kiosk) and `dist/admin.html`. Express rewrites `/admin/*` → `dist/admin.html` for the SPA fallback; kiosk's `/{*splat}` still falls back to `dist/index.html`.

This keeps shadcn out of the kiosk bundle entirely.

### Dev parity

The existing `superclockApi()` plugin in `vite.config.ts` mounts API routes during `vite dev`. Extend it to also mount `device-routes` and (conditionally) `admin-routes`, so both routes work in `npm run dev` without standing up the Express server.

## shadcn install

- `pnpm dlx shadcn@latest init` against the existing Tailwind v4 setup. Use the v4 docs path.
- Apply the user's preset from `https://ui.shadcn.com/create?preset=bJy0dqD4` during init.
- Components live in `src/admin/components/ui/`. Kiosk does not import from there.
- shadcn tokens scoped to `.admin-root` so they don't collide with the kiosk's `@theme` block in [src/index.css](src/index.css).

## Slow Pi adapter

For v1:
- Slow exposes `GET /api/device/capabilities` and `GET /api/device/state` via a minimal embedded HTTP listener (libmicrohttpd or similar) wired into the LVGL binary. JSON shape matches the React clocks.
- `POST /api/device/config` returns 405.
- Admin renders Slow with `readOnly: true`:
  - All write actions disabled.
  - Banner: "Read-only — config is baked into the LVGL build."
  - Live state still displayed.
- v2: add config-apply support in the LVGL binary. Protocol unchanged.

## Auth

- `config/admin.json` on the admin Pi holds `{ token: "<random 32 bytes hex>" }`. Generated during `setup-pi.sh`.
- Admin UI bootstraps via a one-time `/admin/setup?token=…` URL that writes the token to a httpOnly cookie. After that, the cookie auths every `/api/admin/*` request.
- `/api/device/config` (as built): the body is always zod-validated; the admin Pi sends its token as `Authorization: Bearer …` on every push, and a device *requires* it only when that device has its own `config/admin.json` provisioned (copy the admin host's file to each Pi to enforce authenticated pushes). Without the file the route accepts LAN pushes — LAN-trust default, matching the admin surface's dev behavior.
- Good enough for LAN; trivially upgradable to OAuth or Cloudflare Access when we move to web.

## Out of scope for v1

- Marketplace / app discovery — apps are bundled, registered in [src/apps/index.ts](src/apps/index.ts).
- Fleet-wide playlist templates.
- Smart Playlist / skip-stale logic.
- Slow Pi brightness / sleep control.
- Live state via WebSocket — admin polls `/api/device/state` every 5s when visible, `/api/admin/health` every 30s.
- **Complications from non-Clock apps.** Registry is shaped to allow it; UI only surfaces Clock-defined complications in v1.
- **Retrofitting all existing faces with config schemas.** Existing faces ship as no-config stubs; each gets a schema as it's touched.
- **The slow-native LVGL HTTP listener itself.** This repo only publishes the wire contract; the binary is implemented in a separate repo/PR.
- **AppGrid dynamic layout.** The kiosk's `AppGrid` keeps its hand-laid-out Figma layout in v1. The admin's per-device "enabled apps" toggle affects the *playlist* and which apps are pushed to the device — the on-clock grid layout itself is unchanged.

## Implementation order (suggested)

0. **Pre-flight** — add deps (`zod`, `ulid`, `react-router-dom`); rewrite `scripts/setup-pi.sh` to remove nginx and run Express; update `superclock.service` to point at Express; rename device.json files to match locked hostnames.
1. **Shared types + fleet store** — `src/shared/types.ts`, `server/fleet-store.ts`, `config/fleet.example.json`. No UI yet.
2. **Face + complication registries** — `src/shared/face-registry.ts`, `src/shared/complication-registry.ts`, schemas in `src/shared/schemas/`. Stub existing faces with empty configs; one or two complications fully implemented as proof.
3. **Device routes on the kiosk Pis** — `server/device-routes.ts`, capability declarations in `src/shared/capabilities.ts`. Verify by `curl superclock-fast.local:3000/api/device/capabilities`. Refactor [src/apps/clock/ClockApp.tsx](src/apps/clock/ClockApp.tsx) to read `faceId` from instance config (still index-cycle as a fallback when no config present).
4. **Admin SPA scaffold** — second Vite entry, shadcn init under `.admin-root`, empty routes, device-switcher reading from `/api/admin/fleet`.
5. **Admin routes + push** — `server/admin-routes.ts` + `server/device-push.ts`. Wire up Apps tab toggle → device push round-trip.
6. **Face management UI** — My Faces, Face Gallery, Face Config, Complication Picker. Generic schema-driven form.
7. **Playlist UI** — drag-reorder; entries are ScreenInstances (face instances appear here once configured).
8. **Settings UI** — theme/accent/brightness/schedule.
9. **Setup flow** — `setup-pi.sh` generates `admin.json` on the admin Pi; `/admin/setup` exchanges the token for a cookie.

Each step ships independently. Steps 1–2 are zero-risk to the kiosk (additive only). Step 3 introduces the only refactor of existing kiosk code (ClockApp), behind a fallback so old behavior is preserved when no config exists.

## Open follow-ups (decide during implementation, not now)

- Whether non-Clock instances live under "Apps" as a sub-list or get their own "Library" tab.
- Per-app config UI: schema-driven (default) vs hand-built per app where the form has unusual interactions.
- How aggressively to share components between admin and any future on-clock settings app.
- When to broaden complications beyond Clock — and the trigger (a second app wants to render in a slot).
- Slot rendering on-device: how the kiosk's `ClockApp.tsx` reads a face instance config and renders complications. Likely a `useComplication(id, props)` hook backed by the same data sources as the full apps.
