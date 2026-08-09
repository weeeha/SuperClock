# Admin IA v2 — fleet-first shell (P1) — design

Approved 2026-08-08. First implementation slice of the admin redesign
program. Wireframes: Figma board "SuperClock fresh thinking", **Admin Panel**
page (`73:962`) — sitemap `75:626`, phone wireframes `81:701`, desktop keys
`89:720`, settings template + inventory `97:719`, all-apps config `115:937`,
Template v2 `124:949`. Principle docs: [../../admin/foundation.md](../../admin/foundation.md)
(v1 as-built), [../../admin/community-apps.md](../../admin/community-apps.md).

## Program context (approved decomposition)

- **P0 — chores:** ~~commit admin docs~~ (done, `ac05b16`); merge PR #46
  (To-do) — currently CONFLICTING with main, resolve separately (`me:untangle`).
- **P1 — Admin IA v2 (this spec).**
- **P2 — truth & previews:** live component previews, `/api/device/state`
  telemetry (shown-count, last-shown), pending-push visibility, fleet activity
  feed, identify endpoint.
- **P3 — schedule pills:** playlist schema v3 (per-item day-part × weekday
  windows), kiosk rotation filter, admin editor.
- **P4 — apps wave:** 4a Timer + Countdown (+ date widget); 4b Notes + Alarm
  (content stores, capability-gated audio).
- **P5 — mashup + mirror.**
- **P6 — connected & community:** secret store, widget kit v2,
  connect-account, Custom Screen.

P1 decisions locked in dialogue: **approach = new shell + wireframe-fidelity
rebuild** (no interim reskin, no strangler flag); **previews = static registry
art** (face-registry PNGs, app grid icons) with live components arriving in P2
into the same slots; hard route cutover.

## Scope

**In:** new routing + seven surfaces (below), dev-safety push guard,
`pushOutcome` field on config-write responses, deletion of the old page
components + `DeviceSwitcher` + `active-device` store.

**Out (explicitly):** any `fleet.json`/device-config schema change; any kiosk
change; live previews; activity/pending feeds; identify button; schedule UI;
mashup/mirror; maintenance rows (no restart endpoint); desktop-only extras
(ops rail).

## Routing & scope model

- `/admin` → **Fleet Home**.
- `/admin/clock/:deviceId` → **Control Room** layout; nested: index =
  Playlist tab, `apps` = Apps tab, `settings` = Settings tab,
  `apps/:appId` = App Detail, `apps/clock/gallery` = Face Gallery,
  `screens/:instanceId` = Screen Config.
- Legacy paths (`/admin/apps`, `/admin/playlist`, `/admin/settings`,
  `/admin/apps/*`) redirect to `/admin`. Unknown `:deviceId` → redirect to
  `/admin`.
- Device scope's single source of truth is the **URL**, exposed by a
  `useDeviceId()` hook. `src/admin/store/active-device.ts` and
  `DeviceSwitcher.tsx` are deleted. No global device state survives.
- Phone-first single column; desktop is the same layout stretched.

## Surfaces (built to board fidelity)

1. **Fleet Home** — four shape-aware clock cards (round frames; Square gets a
   square thumb; Slow gets `read-only` badge). Card contents: static art for
   the device's current screen (resolve `/api/device/state.currentScreenId` →
   instance → face preview PNG or app icon), name, online dot from a 30s
   `/api/admin/health` poll, "now: X" line, chevron. Offline card: gray dot,
   "last seen", dimmed art. Ghost row links to the existing `/admin/setup`.
2. **Control Room shell** — header: back chevron, clock name, online chip,
   "now: X"; three-tab bar (Playlist default).
3. **Playlist tab** — rotation segmented control (Off/15s/30s/60s over the
   existing `rotationSeconds`); instance rows: static thumb, name + instance
   label, "now" badge when `currentScreenId` matches, drag-reorder via
   dnd-kit (existing `POST …/playlist/reorder`), overflow menu (edit →
   Screen Config, remove); **+ Add screen** primary button.
4. **Add Screen sheet** — bottom sheet (phone) / dialog (desktop). One
   flattened list per foundation decision #7: "Clock faces" group from
   `face-registry` with preview art, then apps from capabilities with grid
   icons. Tap → `POST …/instances` with `defaultsFor(schemaId)` → navigate to
   the new instance's Screen Config. No mashup entry.
5. **Screen Config (template v1)** — zones: header (back, "«label» on
   «Clock»", saved state), static preview slot, name row, `SchemaForm`
   (including list editor + ordered multi-select from PR #49), danger row
   (remove with confirm → also removes from playlist). Schedule/Activity
   zones do not render in P1.
6. **Apps tab + App Detail** — "ON THIS CLOCK" chips (enabled apps), "ALL
   APPS" rows: icon, display name, status subtitle, toggle (`enabledApps`),
   chevron. App Detail: instance list (Clock: My Faces + "+ Add face" →
   Face Gallery), add-instance, app-level rows as today. Existing
   AppDetail/FaceGallery logic is reused restyled; `FaceConfig` is subsumed
   by Screen Config.
7. **Settings tab** — grouped drill-in rows, current values in subtitles:
   Identity (name, host, build stamp from `/api/health`), Display (theme,
   accent, brightness), Night & Sleep. Rows edit inline (segmented/slider)
   or via small sheets, writing `settings` through the normal PATCH.

## Data flow

TanStack Query, keyed `['fleet']`, `['health']`, `['device', id, 'state']`.
Visibility-gated polling only: Fleet Home → health 30s; mounted Control Room →
own state 5s. Mutations: existing `PATCH /api/admin/fleet/:deviceId` and
instance/playlist routes, zod-validated, optimistic updates, invalidate on
settle. No new endpoints; no schema changes.

**Single server touch:** config-write responses (PATCH/POST/DELETE in
`server/admin-routes.ts`) gain `pushOutcome: 'applied' | 'queued' |
'dev-suppressed'` so the UI reports save-vs-push honestly.

## Dev-safety push guard

`server/device-push.ts`: when `NODE_ENV !== 'production'` and the target
device id ≠ the server's own resolved id, skip the network push (fleet.json
still persists), return `dev-suppressed`. Override with
`ADMIN_ALLOW_REMOTE_WRITES=1`. Admin renders an amber "saved here · not
pushed (dev)" chip on that outcome. Closes the dev-Mac-reconfigures-real-
clocks trap found during the array-widgets build.

## Failure modes

- Offline clock: gray card; inside its control room, write affordances
  disabled + banner "clock unreachable — changes will queue" (existing 60s
  retry drain delivers).
- `superclock-slow`: `readOnly` capability hides all write affordances;
  badge in header and card.
- Push failure after save: amber "queued" chip from `pushOutcome`, never a
  false success.
- State poll failure with healthy fleet route: card keeps last-known art,
  "now" line replaced by "state unavailable".

## Testing

- Vitest: legacy-route redirect map; `useDeviceId` (valid/unknown ids);
  Add-Screen creation (defaults + navigation target); push-guard outcomes
  (prod/dev-self/dev-remote/override). Existing suites untouched and green.
- Manual per standing rule: Chrome + Safari at phone width; then deploy to
  fastclock and verify the full round-trip on-device (create face instance →
  reorder playlist → settings change → visible on glass).

## Deliverable & success criteria

One PR from this branch. Done means: all four clocks visible with honest
status from a phone on the LAN; every config path reachable through the new
IA; old routes gone; dev guard proven by test; on-glass round-trip verified
on fastclock; Chrome + Safari checked.
