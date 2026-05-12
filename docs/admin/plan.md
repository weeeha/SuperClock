# SuperClock Admin — Implementation Plan

Concrete, actionable steps for building what [foundation.md](foundation.md) describes. Each step lists files, acceptance criteria, and dependencies. Order matters — early steps unblock later ones.

## TL;DR

10 steps, roughly in sequence:

- **Step 0 (pre-flight)** — deps, deployment, hostname cleanup. *Must land first.*
- **Steps 1–2** — data model + registries. Additive only, zero kiosk risk.
- **Step 3** — device API on every clock + the one kiosk refactor (`ClockApp.tsx` becomes config-aware).
- **Step 4** — admin SPA scaffold (Vite multi-entry, shadcn, router, empty pages).
- **Step 5** — admin routes + device push (first end-to-end fleet write).
- **Steps 6–8** — face management UI, playlist UI, settings UI. Parallelizable after step 5.
- **Step 9** — auth/setup flow.

Highest-risk: Step 3 (kiosk refactor) and Step 4 (Vite + shadcn integration). Everything else is mostly form work and CRUD.

---

## Step 0 — Pre-flight (M)

**Goal:** Resolve infra blockers before adding new code.

**Tasks:**
1. Install deps: `npm install zod ulid react-router-dom @dnd-kit/sortable @dnd-kit/core`.
2. Rewrite [scripts/setup-pi.sh](scripts/setup-pi.sh) — remove the nginx blocks (lines 38–58), make `superclock.service` start Express directly (`npm run start`), update port references in README.
3. Rename device dirs to match locked hostnames:
   - `superclock/` → `superclock-fast/` (existing JSON, update `hostname` field)
   - `square-superclock/` → `superclock-square/` (existing JSON, fix `superclok-square` typo)
   - Create `superclock-small/device.json` and `superclock-slow/device.json` stubs.
4. Update [.gitignore](.gitignore) — add `config/fleet.json`, `config/admin.json`.

**Acceptance:**
- `npm run build && npm run start` still works on dev machine.
- `scripts/setup-pi.sh` has no `nginx` references.
- Four device.json files exist with correct hostnames.

**Depends on:** —
**Risk:** **M** — touches deployment. Run `setup-pi.sh` in a VM or fresh Pi before merging.

---

## Step 1 — Shared types + fleet store (S)

**Goal:** Source-of-truth data model and atomic storage.

**Create:**
- `src/shared/types.ts` — every type from the foundation's Type Model section.
- `server/fleet-store.ts` — `readFleet()`, `writeFleet(fleet)`, `updateDevice(id, fn)`. Atomic via write-to-`.tmp` then `fs.rename`. Bumps `version` on every write.
- `config/fleet.example.json` — all four devices, empty `enabledApps`, `instances`, `playlist`.

**Edit:**
- nothing in the kiosk path.

**Acceptance:**
- `import { type FleetConfig } from 'src/shared/types'` compiles in both kiosk (`tsc -b`) and server (`tsx`).
- `readFleet()` returns the example payload when `config/fleet.json` is absent.
- Two concurrent `writeFleet()` calls don't produce a torn file (manual test: spawn two writes 1ms apart, assert file ends with `}` and parses).

**Depends on:** Step 0
**Risk:** **L** — pure new code.

---

## Step 2 — Face + complication registries (M)

**Goal:** Faces and complications addressable by id from a single source.

**Create:**
- `src/shared/face-registry.ts` — one `FaceDescriptor` per existing face in [src/apps/clock/](src/apps/clock/) (analog, productivity, square, floral, complications-light, complications-dark, world, flip). All stubbed `configSchemaId: undefined, slots: []`.
- `src/shared/complication-registry.ts` — six `ComplicationDescriptor` entries (date, temperature, habit-streak, day-progress, fitness-ring, next-calendar-event). Only `date` and `temperature` get real renderers in this step; the rest are placeholders.
- `src/shared/schemas/complication.date.ts`, `complication.temperature.ts` — zod schemas.
- `src/shared/complications/date.tsx`, `temperature.tsx` — compact React renderers reading from existing data hooks.

**Edit:**
- [src/core/types.ts](src/core/types.ts) — extend `AppMetadata`: `configSchemaId?: string`, `faces?: FaceDescriptor[]`. Existing apps continue to compile (both fields optional).
- [src/apps/clock/index.ts](src/apps/clock/index.ts) — populate `faces` from the registry.

**Acceptance:**
- Registry imports compile in both kiosk and admin.
- A scratch page renders `<Date />` and `<Temperature />` complications in a 60×60 box.
- `getAllApps()` returns Clock with its `faces` array populated.

**Depends on:** Step 1
**Risk:** **L** — additive types only.

---

## Step 3 — Device routes + ClockApp refactor (M)

**Goal:** Each clock self-describes via HTTP; `ClockApp` can render any face by id.

**Create:**
- `server/device-routes.ts` — Express router with `GET /api/device/{capabilities,state,config}` and `POST /api/device/config`.
- `src/shared/capabilities.ts` — static capability declarations keyed by `DeviceId`. `superclock-slow` declares `readOnly: true`, `kind: 'lvgl'`, and an empty `apps[]`. Hostname → DeviceId map lives here too.
- `src/shared/local-config.ts` — `loadLocalConfig()`, `saveLocalConfig(config)`. Reads/writes `localStorage['superclock:device-config']`.
- `server/api-mount.ts` — shared `mountApi(app)` helper that both [server.ts](server.ts) and the Vite dev plugin in [vite.config.ts](vite.config.ts) call. Eliminates dev/prod route drift.

**Edit:**
- [server.ts](server.ts) — add `app.use(express.json())`; mount device-routes via `mountApi()` *before* the `/{*splat}` SPA fallback.
- [vite.config.ts](vite.config.ts) — replace the inline middleware in `superclockApi()` with a call to `mountApi()`.
- [src/apps/clock/ClockApp.tsx](src/apps/clock/ClockApp.tsx) — accept `config?: { faceId?: string }` from `AppProps`. If `config.faceId` matches a registered face id, render that face; otherwise fall back to the existing index-cycle. **The fallback is what keeps the kiosk working in v1 even before any config is pushed.**
- [src/core/types.ts](src/core/types.ts) — extend `AppProps` with `config?: Record<string, unknown>`.

**Acceptance:**
- `curl http://localhost:3000/api/device/capabilities` returns JSON in dev (`npm run dev`) and prod (`npm run start`).
- Manual: `localStorage.setItem('superclock:device-config', '{"instances":[{"id":"x","appId":"clock","config":{"faceId":"flip"}}],"playlist":{"items":["x"]},...')`, reload — kiosk shows FlipClock.
- Manual: delete the localStorage key, reload — kiosk reverts to existing swipe-cycle behavior.
- `curl -X POST http://localhost:3000/api/device/config -H 'content-type: application/json' -d '{...}'` writes to localStorage on the kiosk side via a small bootstrap in `main.tsx` that listens for SSE/polling (or just on next reload — pick the simplest: kiosk polls `/api/device/config` every 5s).

**Depends on:** Steps 1, 2
**Risk:** **M** — first touch to working kiosk code. Mitigated by config-optional fallback.

---

## Step 4 — Admin SPA scaffold (M)

**Goal:** Empty admin app boots at `/admin` with shadcn primitives and a device switcher.

**Create:**
- `admin.html` (repo root) — second Vite entry, references `src/admin/main.tsx`, root `<div id="admin-root" class="admin-root">`.
- `src/admin/main.tsx`, `App.tsx`, `index.css` — entry + router root + shadcn `@theme` block scoped to `.admin-root`.
- `src/admin/routes/dashboard.tsx`, `apps.tsx`, `playlist.tsx`, `settings.tsx` — stub pages, just titles.
- `src/admin/components/device-switcher.tsx` — top-right `DropdownMenu` (shadcn) showing the four devices from `GET /api/admin/fleet`.
- `src/admin/components/ui/` — shadcn init output (button, card, dropdown-menu, sheet, dialog, separator, tabs as a starter set).
- `src/admin/lib/api.ts` — typed fetch wrappers using zod schemas from `src/shared/`.
- `src/admin/lib/query.ts` — `QueryClient` + provider.
- `src/admin/store/active-device.ts` — Zustand store with `activeDeviceId`, `setActiveDevice`.

**Edit:**
- [vite.config.ts](vite.config.ts) — add `build.rollupOptions.input = { kiosk: 'index.html', admin: 'admin.html' }`. Configure dev server to serve `/admin/*` from admin.html.
- [server.ts](server.ts) — SPA fallback for `/admin/*` → `dist/admin.html`; existing `/{*splat}` → `dist/index.html`. **Order matters — admin pattern first.**

**Acceptance:**
- `npm run dev` then visit `http://localhost:5173/admin` — admin app renders with device switcher dropdown (data: stub from `/api/admin/fleet` returning 404 → switcher shows "no devices reachable" empty state).
- `npm run build` produces `dist/index.html` AND `dist/admin.html`, both with their own asset chunks.
- Verify with `du -h dist/assets/*` that `kiosk-*.js` does not contain `shadcn` strings (`grep -l shadcn dist/assets/kiosk*` returns nothing).

**Depends on:** Steps 1, 2, 3
**Risk:** **M** — Vite multi-entry + shadcn v4 init is the most likely place to need an iteration.

---

## Step 5 — Admin routes + device push (M)

**Goal:** Admin can read/write fleet config; changes round-trip to the device.

**Create:**
- `server/admin-routes.ts` — Express router: `GET /api/admin/fleet`, `GET/PATCH /api/admin/fleet/:deviceId`, `POST/PATCH/DELETE` for instances, `POST /api/admin/fleet/:deviceId/playlist/reorder`, `GET /api/admin/health`.
- `server/device-push.ts` — push helper using `fetch`. 5s timeout per request, retry on the next 30s reachability poll. Tracks per-device `pending` state in memory.
- `server/admin-token.ts` — stub middleware that reads `config/admin.json` on boot and validates an `Authorization: Bearer …` header or a session cookie (real impl in Step 9; for now accept anything when no `config/admin.json` exists).

**Edit:**
- [server.ts](server.ts) — mount admin-routes only when `process.env.ADMIN_HOST === 'true'`. Add bearer-token middleware in front.
- `src/admin/routes/apps.tsx` — first real screen. Lists registered apps from device capabilities; toggle Apps on/off → PATCH `/api/admin/fleet/:deviceId` → push to device → re-fetch capabilities to confirm.

**Acceptance:**
- Toggle an app off in admin → fleet.json updates → device's localStorage cache updates within 5s → `GET /api/device/config` reflects it.
- With target Pi unreachable: admin returns optimistic 200; status shows "pending"; bring Pi back online → next 30s poll syncs.
- `ADMIN_HOST=false` (default): `/api/admin/*` returns 404.

**Depends on:** Steps 1, 4
**Risk:** **M** — first end-to-end fleet operation; concurrency edge cases possible.

---

## Step 6 — Face management UI (L)

**Goal:** Apple-Watch-style face/instance/complication management.

**Create:**
- `src/admin/routes/apps.$appId.tsx` — drill-down. For `clock`, renders "My Faces" list (face instances). For others, renders a single config screen.
- `src/admin/routes/apps.clock.faces.$instanceId.tsx` — Face Config: face preview, color picker, slot grid.
- `src/admin/routes/apps.clock.gallery.tsx` — Face Gallery: catalog of registered face types with thumbnails.
- `src/admin/components/face-card.tsx`, `face-gallery-card.tsx`, `face-config-form.tsx`, `slot-grid.tsx`, `complication-picker.tsx` (drawer/sheet).
- `src/admin/lib/schema-form.tsx` — generic zod → form renderer. Supported field types in v1: `string`, `enum` (select), `color` (custom). `number` if trivial.

**Edit:**
- `src/admin/routes/apps.tsx` — make Clock card clickable, route to `/admin/apps/clock`.

**Acceptance:**
- Create a face instance (Analog with default settings — no schema), pick a complication for an Infograph-shape slot once schemas are added.
- Round-trip: open a saved face instance, re-edit, save again — no data loss.
- Add via "+ Add Face" → Face Gallery → tap a face card → new instance created with defaults, opens Face Config.

**Depends on:** Steps 2, 5
**Risk:** **M** — schema-driven forms have many edge cases; v1 supports 2–3 field types only.

---

## Step 7 — Playlist UI + auto-rotation (M)

**Goal:** Per-device drag-reorder of screen instances; kiosk auto-cycles through them.

**Create:**
- `src/admin/routes/playlist.tsx`
- `src/admin/components/playlist-row.tsx` — number + thumbnail + name + sub-config + last-shown + drag handle + overflow.
- `src/admin/lib/dnd.ts` — wrapper around @dnd-kit's sortable.
- `src/core/playlist.ts` (kiosk side) — auto-rotation tick. Reads `DeviceConfig.playlist.rotationSeconds`; calls `switchToApp()` on tick. Pauses for 30s after any user gesture.

**Edit:**
- [src/App.tsx](src/App.tsx) — wire `usePlaylist()` to drive `switchToApp` calls.
- [src/core/navigation.ts](src/core/navigation.ts) — expose a "last user gesture timestamp" the playlist hook reads.

**Acceptance:**
- Reorder via drag in admin → fleet.json + device localStorage updated → kiosk picks up new order on next tick.
- Set `rotationSeconds: 30`, add three screens — kiosk cycles every 30s.
- Manual swipe pauses auto-rotation for 30s.

**Depends on:** Steps 5, 6
**Risk:** **M** — auto-rotation needs to coexist with existing swipe gestures.

---

## Step 8 — Settings UI (S)

**Goal:** Theme, accent, brightness, sleep schedule.

**Create:**
- `src/admin/routes/settings.tsx` — form with shadcn primitives.

**Edit:**
- [src/index.css](src/index.css) — keep `--color-accent` in `@theme`; add a runtime override mechanism (a `<style>` tag injected at boot that overrides accent from cached config).
- [src/App.tsx](src/App.tsx) or [src/main.tsx](src/main.tsx) — apply theme/accent from `loadLocalConfig()` on boot.
- [scripts/superclock.service](scripts/superclock.service) or a sibling script — accept a brightness signal; the kiosk shell shells out to `wlr-randr` or `xrandr` when brightness changes (real impl can be deferred to a follow-up).

**Acceptance:**
- Change accent in admin → kiosk reflects on next config poll.
- Brightness control works on `superclock-fast`/`small`/`square`; on `slow` it's disabled with a "read-only" indicator.
- Sleep schedule fades the display at the wake/sleep times.

**Depends on:** Step 5
**Risk:** **L** — mostly form work. Brightness adapter may need a follow-up depending on what `labwc` exposes.

---

## Step 9 — Setup flow / auth bootstrap (S)

**Goal:** Token-based auth without a login screen.

**Create:**
- `src/admin/routes/setup.tsx` — reads `?token=…` from query, POSTs to `/api/admin/auth/exchange`, server sets httpOnly cookie, redirects to `/admin`.

**Edit:**
- `server/admin-routes.ts` — add `POST /api/admin/auth/exchange` and the cookie-check on every other admin route.
- `server/admin-token.ts` — real implementation; load `config/admin.json`, compare tokens with `crypto.timingSafeEqual`.
- [scripts/setup-pi.sh](scripts/setup-pi.sh) — generate `config/admin.json` with `openssl rand -hex 32` on first run, only on the admin Pi. Print the setup URL with `?token=…` so the user can paste it into their phone once.

**Acceptance:**
- Fresh Pi + `setup-pi.sh` prints `https://superclock-fast.local:3000/admin/setup?token=abc…`.
- Opening that URL on phone sets a cookie; subsequent `/admin` visits work without the token query param.
- Visiting `/admin` without the cookie redirects to `/admin/setup`; without `?token=` shows "missing token" error.

**Depends on:** Step 5
**Risk:** **L** — small surface, well-scoped.

---

## Parallelization

Sequential because of data-model dependencies: **Step 0 → 1 → 2 → 3**.

After Step 3 lands, these can run in parallel as separate PRs:
- Step 4 (admin scaffold)
- Step 8 kiosk-side wiring (apply cached theme/accent from boot)

After Step 5 lands:
- Steps 6 (face UI) and 7 (playlist UI) in parallel.
- Step 9 (auth) independent.

## Risk summary

| Step | Risk | Reason | Mitigation |
|------|------|--------|------------|
| 3 | M | First refactor of working kiosk code | Config-optional fallback preserves current behavior |
| 4 | M | Vite multi-entry + shadcn v4 init | Time-box the shadcn integration; if it's painful, scope shadcn to admin only via a sub-package |
| 7 | M | Auto-rotation + user swipe coexistence | 30s pause after any gesture; verify with manual testing |
| 0 | M | Touches deployment | Run setup-pi.sh against a fresh Pi or VM before merging |
| 1, 2, 8, 9 | L | Additive or small surface | Standard PR review |
| 5, 6 | M | First end-to-end push; schema-form edge cases | Land Step 5 with a single round-trip case (toggle an app) before extending to instances/complications in Step 6 |

## Out of repo

- **slow-native LVGL HTTP listener.** This plan publishes the wire contract via `src/shared/types.ts` and `src/shared/capabilities.ts`. The actual implementation lands in a separate repo/PR. Until then, `superclock-slow` shows up in the admin as unreachable (or marked read-only); admin UI handles that gracefully.
- **`minimalismo` watchface.** Referenced in earlier memory but not in this worktree. Add as its own task — register in `face-registry.ts`, add the component to `src/apps/clock/`.

## Open during implementation

- AppGrid layout: the kiosk's hand-laid-out grid stays as-is in v1 (admin's "enabled apps" toggle affects only the playlist, not which apps appear on the grid). Worth revisiting after Step 5 ships and you've used it for a week.
- TanStack Query is in deps but unwired at the kiosk level. Admin uses it from Step 4. Decide later whether the kiosk should adopt it too for its existing `/api/calendar` and `/api/photos` fetches.
