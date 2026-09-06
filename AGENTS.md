# Agent instructions - SuperClock

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project context

SuperClock is a smart-clock dashboard for a fleet of four Raspberry Pis driving Waveshare round/square LCDs. Per-device hardware specs live in `superclock-{fast,small,square,slow}/device.json` (fast is a Pi 5; the others are Pi 4-class; `slow` runs a separate native LVGL binary — not Chromium). The UI is laid out for a circular 1080×1080 viewport on the round devices, so most full-screen surfaces assume a 1:1 aspect ratio. Two SPAs ship from one Vite build: the **kiosk** (`index.html`, full-screen touch UI) and the **admin** (`admin/index.html`, fleet management at `/admin`), both served by the bundled Express server on every Pi.

**Agent log:** parallel worktree sessions hand work over through `AGENT-LOG.md`, not PRs. Append an entry (what changed, files, verified, decisions, open) before finishing a chunk of work.

**Path-scoped rules:** this file states every rule, but three bodies live in `.claude/rules/*.md` with `paths:` frontmatter, so Claude Code loads them only when you touch matching files. Read the named file directly if your agent does not do that for you. `scripts/lib/rules-scoped.test.ts` holds the split honest: every rule declares globs that match real files, and its one-line summary must still appear here.

## Commands

```bash
npm run dev        # Vite dev server with HMR (port 5180 via .claude/launch.json); /api/* served in-process
npm run build      # tsc -b + vite build (kiosk + admin) + esbuild server bundle → dist/ (incl. dist/server.mjs)
npm run start      # node dist/server.mjs — production server (build first), listens on 0.0.0.0:$PORT (default 3000)
npm run start:src  # tsx server.ts — run the server from source without building
npm run lint       # ESLint over **/*.{ts,tsx}
npm test           # Vitest — time-window, fleet-store, registry coherence + contract, navigation invariants
npm run check:tokens        # token gate: semantic-only zones + face --face-* rule (scripts/check-tokens.mjs)
npm run check:rules         # rule catalogue report: rules/superclock.json via scripts/rulecheck.mjs (exit 1 on any hit; npm test enforces the policy)
npm run report              # regenerate docs/health.md from the registries, ledgers and rule catalogue (npm test fails when it is stale)
npm run new:app -- <id>     # scaffold a kiosk app across every registry touchpoint, red-by-construction, born consuming its schema
npm run new:face -- <id>    # scaffold a clock face likewise (born consuming --face-* and its schema)
./scripts/gates.sh          # the local CI mirror — lint → check:tokens → test → build, in ci.yml's order
```

The **registry coherence test** (`src/shared/registry-coherence.test.ts`) pins the app/face/schema registries together — if you add an app or face and `npm test` fails, it is telling you which list you forgot (see Conventions). Its sibling `registry-contract.test.ts` catches what coherence can't: files that reached NO registry (a forgotten side-import, an unregistered schema file, missing preview art). The third, `schema-liveness.test.ts`, checks the direction neither of those can: a schema the admin renders a form for must be value-imported by the component that owns it (the Calendar pattern, `schema.safeParse(config ?? {})`), or sit on the shrink-only `SCHEMA_UNREAD` ledger with a reason (frozen at 14 of 27 on 2026-09-05 and paid down to zero the same day: decision D4 is now mechanical; `import type` does not count). Prefer the scaffolders — they emit every touchpoint at once plus a todo test that stays red until the component is implemented.

### Pi deployment

**Pi deployment** — what `deploy.sh` ships, its guards and the live systemd naming drift live in `.claude/rules/pi-deployment.md` (loaded automatically when you touch a deploy or provisioning script). Never trust `dist/` mtimes; `/api/health` carries the build stamp.

## Architecture

### Two SPAs, one server

- **Kiosk** (`src/` root, `src/apps/`, `src/core/`): store-driven, **no router** — do not introduce react-router here.
- **Admin** (`src/admin/`): react-router 7 + TanStack Query + shadcn-style components scoped under `.admin-root`. Served at `/admin` (only meaningful on the admin host).
- **Server** (`server.ts` + `server/`): Express 5. Real API surface — `/api/health`, `/api/calendar`, `/api/photos`, `/api/claude-usage` and `/api/github/contributions` (server-side proxies; secrets never reach the browser), `/api/device/*` (capabilities/state/config; config POST is zod-validated and optionally token-gated), `/api/admin/*` (fleet CRUD behind bearer/cookie auth, admin host only). Unmatched `/api/*` 404s as JSON before the SPA fallbacks. The same API app is mounted into Vite in dev (`vite.config.ts`).

### Fleet config pipeline (admin → kiosk)

`config/fleet.json` on the admin host is the source of truth (`server/fleet-store.ts`: atomic fsync'd writes, corrupt-file quarantine, serialized read-modify-write). Admin mutations validate against `src/shared/device-config-schema.ts` (zod), persist, then push to the target device's `POST /api/device/config` (failed pushes retry every 60s). Each kiosk polls its own `GET /api/device/config` every 5s with a localStorage last-good cache (`src/shared/local-config.ts`). The kiosk **consumes** this config: `enabledApps` filters the swipe order (empty = all), playlist auto-rotation drives `switchToInstance`, `settings` feeds theme/night/brightness (`src/core/apply-settings.ts`), and clock instances receive `faceId` + merged `face` options (see `ClockApp.tsx` → `FaceProps.faceConfig`; `AnalogClock` is the reference consumer).

### App registry + lazy loading

Every mini-app is a module under `src/apps/<name>/` with an `index.ts` calling `registerApp({ metadata, component: lazy(...) })` and a `<Name>App.tsx` default-exporting a component receiving `AppProps` (`{ isActive, config? }`). **Adding a new app requires:** the side-import in `src/apps/index.ts`, an entry in `ALL_KIOSK_APP_IDS` in `src/shared/capabilities.ts`, a row in `src/shared/app-capabilities.ts` (what it does: fetches / ticks / multiView; what it needs: audio / mic / radar), and (unless it's config-free) an `app.<id>` schema in `src/shared/schemas/` + `src/shared/schema-registry.ts`. `npm test` fails until all lists agree, and `app-capabilities.test.ts` fails when a capability row contradicts the code. Faces additionally need: component + `FACE_COMPONENTS`/`SWIPE_CYCLE_ORDER` in `src/apps/clock/face-components.ts`, a `face-registry.ts` entry, and a `face.<id>` schema. **Don't hand-assemble these** — `npm run new:app -- <id>` / `npm run new:face -- <id>` emit every touchpoint (transactionally: a drifted anchor or duplicate id aborts with nothing written) plus a failing todo test; implementing the component and deleting that test is the definition of done.

### Navigation state and gestures

**Gestures and the nav-store contract** — arc zones, the `mode: 'transitioning'` invariant and the guarded-cleanup shape live in `.claude/rules/gestures-and-navigation.md` (loaded automatically when you touch `src/core/**` or an app component). Gated as `NAV-1`/`NAV-2` in `rules/superclock.json` and by `src/core/navigation.test.ts`.

### Conventions

- **`docs/health.md` is the map, and it is generated.** Apps with their capabilities and schema-read state, faces with their night-token state, all 27 schemas, the rule catalogue with its unchecked and delegated rules and every sanctioned exemption, the four devices with their hardware flags — rendered by `npm run report` from the registries themselves. It asserts nothing (the gates do that) and `npm test` fails when the committed copy is stale, so read it instead of counting things by hand, and never edit it.
- **App capabilities are declared, then checked.** `src/shared/app-capabilities.ts` says what each app does (`fetches`, `ticks`, `multiView`) and needs (`audio`, `mic`, `radar`); `app-capabilities.test.ts` holds every row to the code (fetch(), timers, swipe registration, an honest tell for fetching apps) and every hardware need to a device `FeatureFlag` in `capabilities.ts`, which now declares `audio`/`mic`/`radar` per device from fleet.md. The lists ride the capability wire as `AppDescriptor.capabilities`; gating UI on them (a "no mic on this device" tell, hiding an app a device cannot run) is a follow-up decision, not implied.
- **Design rules are records, not prose.** `rules/superclock.json` holds every rule with its severity and its detector: `grep`/`heuristic`/`requires` rules run mechanically, `judgment`/`rendered` rules are printed as unchecked on every run, `delegated` rules name the gate that enforces them (the token gate, ESLint). Schema in `scripts/lib/rule-schema.mjs`; every mechanical rule proves itself on a bad/good fixture pair under `scripts/lib/__fixtures__/rules/`. Add a rule there, never as a new bullet here without a record.
- **Active-aware effects:** gate `setInterval`/rAF on `props.isActive` — background apps must not tick (the grid overlay deactivates the app under it). Kiosks run for weeks; leaked timers and per-second re-renders are real heat on a Pi. Gated as `KIO-1`.
- **Honest offline:** apps that fetch must show an explicit offline tell (see WeatherApp/GithubApp) — never render fallback/mock data as if live.
- **Secrets are server-side.** `VITE_`-prefixed env vars are inlined into the public bundle — never put a token in one; add a server proxy route instead (github/claude-usage pattern).
- **Tailwind v4** via `@tailwindcss/vite`; kiosk theme tokens live in `src/index.css` under `@theme` (admin tokens separately in `src/admin/index.css`). No `tailwind.config.*`.
- **TypeScript:** `verbatimModuleSyntax` + `erasableSyntaxOnly` (type-only imports must use `import type`; no enums), `noUnusedLocals`/`noUnusedParameters` on.
- **Static assets** are hashed PNG/SVG files in `public/` referenced by absolute path — the grid map in `AppGrid.tsx` and face previews in `face-registry.ts` point at them; don't rename without updating both.
- **Touch/scroll is locked globally** in `src/index.css`; anything scrollable inside an app opts back in locally.

### Clock faces

**Clock faces** — the hand-angle source of truth, the `--face-*` night contract, the one-accent rule and React ↔ LVGL parity live in `.claude/rules/clock-faces.md` (loaded automatically when you touch a face). Gated as `FCE-1`/`FCE-2`/`FCE-3` and `KIO-3` in `rules/superclock.json`.

## Traps already paid for

Each of these cost a debugging session once. Don't pay again.

- **Local main lags origin/main while `deploy.sh` ships LOCAL state** — the recurring "my fix didn't stick" failure. The SessionStart hook prints the drift; `git pull` main before any deploy. Never trust `dist/` mtimes either (rsync preserves them — `/api/health`'s build stamp is the truth).
- **Fresh worktrees start without `node_modules`** — run `npm ci` before tests or build. The SessionStart hook warns.
- **This checkout path contains spaces** (`ClaudeCode Projects`). Quote every shell path; in node scripts use `fileURLToPath(import.meta.url)`, never `URL.pathname`.
- **Issue refs like `#1234` parse as hex** in the token gate — write `GH-1234` in gated sources.
- **ESLint runs the full react-hooks v7 Compiler ruleset** — hooks fixes must satisfy it, not just the classic two rules.
- **An unconditional cleanup that nulls a shared nav-store slot stomps the incoming app's registration** (SwipeContainer's `popLayout` keeps the exiting app mounted) — copy HabitsApp's guarded cleanup exactly.
- **A grep for a rule's keyword is satisfied by a comment that merely mentions it.** `useCalendarEvents.ts` says `isActive` only in its doc comment while gating through `enabled`; a plain grep read it as gated. `scripts/rulecheck.mjs` strips comments before matching for exactly this reason, so measure with `npm run check:rules`, not with a raw grep, before calling a rule "clean on the tree".

## Known gaps — port, don't reinvent

- **No Storybook / a11y-contrast gate.** Contrast is checked by eye. The proven pattern (every story an axe test in real Chromium — jsdom silently skips `color-contrast`) lives in the sibling `Minimal-Design-System` repo; port it, don't rebuild it.
- **The one-accent-quantity rule and LVGL parity are review-enforced, not gated** (`FCE-1`/`FCE-2` in `rules/superclock.json`, declared `judgment` so every `check:rules` run prints them as unchecked instead of passing them). The planned fix is the shared JSON face-spec above.
- **Rule severities are earned, not declared.** A rule with debt on the tree ships at `review` with a `BASELINE` row per (rule, file) in `scripts/lib/rulecheck-tree.test.ts`, held two-way (no growth, and a fixed row must be deleted), and is promoted to `blocker` when its rows reach zero. `NAV-1` walked that path on 2026-09-05 (Agents and Weather adopted HabitsApp's guard); the baseline is empty and meant to stay so.
- **Seven legacy faces are exempt from the `--face-*` night rule** (`FACE_TOKEN_EXEMPT` in `scripts/lib/token-rules.mjs`). The list may only shrink: retrofit a face, delete its line.

## Open decisions — flag, don't silently pick

Resolving any of these to make a gate or review pass is not yours to do. Propose with evidence and wait.

- **Two default oranges coexist**: the kiosk CSS fallback `--color-accent: #ff8826` (src/index.css) vs the config default `DEFAULT_ACCENT = '#ff6b35'` (src/shared/types.ts, applied once config arrives). Unifying them changes on-glass color — it is a design decision, not a cleanup.
- **The admin styles semantic colors via arbitrary values** (`text-[hsl(var(--success))]`) because `src/admin/index.css` has no `@theme` block. Moving to real utilities is open; don't drift the file into a mix of both idioms.
- **Admin border-color utilities are dead on arrival**: the unlayered `.admin-root *` border-color reset in `src/admin/index.css` outranks every layered Tailwind utility (`border-amber-400/30` never rendered either — computed-style verified 2026-08-14). Layering the reset under `@layer base` would revive them and change borders across the admin; decide deliberately, don't fix in passing.
- **Do not quietly change a face's palette or geometry to turn a check green** (contrast, parity, token gate). The face's look is the product; a red check on a deliberate design is a conversation, not a fix-forward.
