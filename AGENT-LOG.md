# Agent log

Newest entry first. Several agent sessions work this repo in parallel worktrees and
there are no PRs to hand work over, so this file is the handoff surface. Append an
entry before finishing a chunk of work, not only at session end. Each entry says:
what changed, which files, what was verified, decisions taken, what is still open.

## 2026-09-05 · item 5: regenerable health report (docs/health.md)

- **What:** `npm run report` renders `docs/health.md` from the registries, the ledgers and the
  rule catalogue: 14 apps with capabilities, config schema and whether it is read; 13 faces with
  night-token state; all 27 schemas plus the SCHEMA_UNREAD ledger; the 25 rules with their method
  and severity counts, the live tree scan, the BASELINE, the unchecked and delegated lists and
  every sanctioned exemption with its reason; the 4 devices with features and hardware flags.
  It asserts nothing — the gates do that — and the committed copy is held to a fresh render by
  `npm test`, so nobody reads a stale map.
- **Refactors it forced (both good):** the schema-liveness ledger and predicate moved out of the
  test into `src/shared/schema-liveness.ts`, and the rule BASELINE into
  `scripts/lib/rule-baseline.mjs`, so the report and the gates read one implementation each
  instead of the report re-deriving them.
- **Changed:** `scripts/lib/health-report.ts` + `.test.ts` (new), `src/shared/schema-liveness.ts`
  (new), `scripts/lib/rule-baseline.mjs` (new), `schema-liveness.test.ts` and
  `rulecheck-tree.test.ts` (import the shared modules), `package.json` (`report` script),
  `AGENTS.md` (command + a Conventions bullet), `docs/health.md` (generated).
- **Verified:** gate red on the missing module, then red again for naming FACE_TOKEN_EXEMPT only
  implicitly (the fix names the ledger and its shrink-only contract in the report, which is the
  more useful output); determinism asserted by rendering twice; a hand-edited copy fails and a
  regenerated one passes. gates.sh green: lint, check:tokens, 44 files / 679 tests, build.
- **What the first report shows:** every schema read (27/27), both ledgers empty, 0 rule
  violations over 165 files, 7 rules permanently unchecked (4 judgment, 3 rendered), 3 delegated,
  8 sanctioned exemptions, and the fleet's hardware split (audio and radar on fast only).
- **Open:** none for item 5.

## 2026-09-05 · item 4: docs drift gate + the stale entry docs

- **What:** `scripts/lib/docs-drift.test.ts` (117 checks) holds the claims AGENTS.md and the entry
  docs make about the tree to the tree: every backticked repo path exists (brace-expanded,
  basename search for bare filenames), every backticked identifier appears in the code roots,
  every `--token` prefix is declared in a stylesheet, every rule id is in `rules/*.json`, every
  `npm run` script is in package.json; README's app list and the "N apps registered" counts in
  `directive/foundation.md` and `docs/architecture.md` match the registry parsed from
  `src/apps/index.ts`. It catches stale names and counts, never wrong advice.
- **Ledgers:** `NOT_IN_TREE` (dist/, server.mjs, build-info.json, .env, superclock.service,
  config/fleet.json, config/admin.json) with reasons, checked two-way against `git ls-files` (a
  name that becomes tracked must leave); `MUST_NOT_EXIST_IN_CODE` (BackChevron) asserts a
  deletion AGENTS.md relies on stays deleted.
- **Docs fixed (the gate's first red):** README app list 10 → 14 with registry descriptions,
  `VITE_GITHUB_TOKEN` row replaced by the server-side `GITHUB_TOKEN` (docs-site gap 08, open since
  July), "falls back to mock" wording removed, scripts block gains test + gates.sh, pointer to
  AGENTS.md; foundation.md and architecture.md 11 → 14 apps; AGENTS.md's hand-kept "Users:" list
  of swipe registrants (7 of 10, stale) replaced by a pointer to the `multiView` declarations the
  capability contract already holds to the code.
- **Gate bugs found on the first run:** dist/ exists on a developer disk after a build, so
  "in the tree" now means tracked by git; the gate was reading its own ledger as code (excluded).
- **Verified:** red on exactly the four stale docs plus the two gate bugs; green after.
  43 files / 673 tests, lint, tsc.
- **Open:** none for item 4.

## 2026-09-05 · item 3: app capability contract + device hardware flags

- **What:** structured metadata that is checked, never trusted. `src/shared/app-capabilities.ts`
  declares per app what it does (`fetches`, `ticks`, `multiView`) and needs (`audio`, `mic`,
  `radar`); `app-capabilities.test.ts` (54 checks) holds every row to the code: fetches ⇔ the
  directory calls fetch() and carries an honest tell, ticks ⇔ it owns a timer/rAF, multiView ⇔ it
  registers the swipe slot; every hardware need is a `FeatureFlag` some device provides; the wire
  descriptor carries the list. Declarations were derived from a grep table, not guessed:
  agents mic (voice design, mock today), breathing radar, fitness audio (circuit cues),
  time-tracking radar (presence), every fetching app has its tell.
- **Device flags:** `FeatureFlag` gains `audio` | `mic` | `radar`; `capabilities.ts` declares
  them from fleet.md and device.json (fast: Fusion HAT mic + speaker, hosts the A121; small and
  square: USB mic; slow: none). Admin Settings reads flags by name, so the new ones are inert
  there. `AppDescriptor.capabilities` is optional on the wire (LVGL JSON stays valid).
  `devicesProviding(flag)` lives in capabilities.ts (app-capabilities.ts is a leaf on purpose:
  importing capabilities.ts back would be a module cycle).
- **Scaffolder:** `new:app` now inserts an empty `'<id>': [] // SCAFFOLD-TODO` row
  (`insertAppCapabilities`, pinned in scaffold-templates.test.ts); the contract test then holds
  the row to the code as the app is implemented.
- **Changed:** `src/shared/types.ts`, `app-capabilities.ts` (new), `app-capabilities.test.ts`
  (new), `capabilities.ts`, `scripts/lib/scaffold-templates.mjs`, `scaffold-templates.test.ts`,
  `scripts/new-app.mjs`, `AGENTS.md` (adding-an-app list + Conventions bullet).
- **Verified:** contract red on the missing module, green first run (facts matched the table);
  scaffold test red on the missing insertion, green after; scaffold smoke `new:app cap-smoke`
  passed contract + coherence + registry-contract + liveness with only the by-design todo test
  red, tsc clean, smoke removed surgically (git checkout would have wiped the uncommitted
  capabilities.ts edits: reverted by line instead). 42 files / 556 tests, tsc, lint green.
- **Decisions to flag, not taken:** whether a device without `mic` should stop OFFERING Agents
  (supportedAppIds), and whether the kiosk should show "no mic on this device" tells; both are
  product calls now backed by data. Radar is declared on fast only (the sidecar runs there).
- **Open:** none for item 3.

## 2026-09-05 · item 2, batch d: the last three apps wired (Claude usage, Fireplace, GitHub) — SCHEMA_UNREAD is empty

- **What:** item 2 complete. Every declared schema (27) is value-imported by its component; the
  ledger is empty and AGENTS.md says so.
- **Claude usage:** `refreshSeconds` drives the poll (default aligned 60 → 30, the historical
  interval); `moodEnabled=false` leaves the metrics without the sprite and stops its rotation
  tick. `scope` cannot be honoured (the daemon reports one rollup), so it is the first user of
  a new `FieldMeta.unimplemented` note: the admin renders the control disabled with
  "Not applied on the glass yet: …" (string, number, enum, boolean branches of schema-form;
  never hidden, never silently broken).
- **Fireplace:** `src/apps/fireplace/fire-params.ts` (pure, 11 tests): `spawnPerFrame`
  (calm 1 / medium 3 / roaring 6), `flameColor` (classic reproduces the original gradient
  verbatim; cool/blue/purple are a first cut to tune on glass), `emberColor`. The effect
  restarts on a config push.
- **GitHub:** `src/apps/github/github-config.ts` (pure, 9 tests): `paletteFor` (default = the
  historical greens; monochrome greys; accent ramps into `var(--color-accent)` via color-mix),
  `cacheKeyFor` (blank keeps the historical key so an existing cache still seeds the boot
  paint; a username gets its own key), `contributionsUrl`. The app is now `GithubApp` (parses
  config) → `GithubGraph` keyed on the cache key, so a username change remounts with that
  user's cache instead of briefly painting another user's graph; sub-views take `colors`;
  `refreshMinutes` drives the interval (default 30 = historical). `server/github-proxy.ts`:
  `?username=` switches the GraphQL subject from viewer to `user(login:)`, validated by
  `isValidLogin` before interpolation (400 otherwise), cache and single-flight per login
  (`server/github-proxy.test.ts`, 4 tests).
- **Changed:** the files above plus `src/shared/types.ts` (FieldMeta.unimplemented),
  `src/admin/lib/schema-form.tsx`, `app.claude-usage.ts`, `schema-liveness.test.ts` (3 → 0).
- **Verified:** gate red on exactly the three; pure suites red on missing modules/exports, green
  after. 41 files / 501 tests, tsc, lint, check:tokens green; check:rules 0 violations.
  Dev preview (5181): Fireplace canvas mounted; GitHub honest empty state ("set GITHUB_TOKEN on
  the server") painting 364 level-0 dots from the palette; Claude usage metrics + sprite +
  "auth expired" tell. Console carried 17 stale HMR errors from mid-edit churn (Invalid hook
  call while modules were half-updated); a reload added none. Not exercised in the browser:
  the disabled `scope` control in the admin form (needs an instance; the change is JSX only),
  the non-default hues/intensity/palettes, a non-blank username against real GitHub.
- **Open:** none for item 2. Follow-ups noted, not started: tune the cool/blue/purple flames on
  glass; the seven legacy faces still on FACE_TOKEN_EXEMPT (night tokens, a separate retrofit).

## 2026-09-05 · item 2, batch c: three faces with behaviour wired (Productivity, Flip, World)

- **What:** the last three legacy face schemas. Defaults aligned to today's rendering:
  `face.productivity` accent #ffcc00 → #ff8826 (date, second hand, hub), `face.flip` accent
  #f97316 → #ffffff (the digits have always been white), `face.world` accent #3b82f6 → #ee0000
  (the primary dial's second hand and hub ring). New behaviour only when configured:
  Productivity `showSeconds=false` hides the second hand; Flip `hour24=false` renders 12-hour
  digits (two digits kept so the panel width never jumps) plus an AM/PM label in the accent
  colour; World `primaryTimezone` drives the primary dial's hour and minute hands through
  `src/apps/clock/world-time.ts` (pure: resolveTimezone, timeInTimezone, handDegreesInTimezone;
  same formulas as useClockHands). An IANA name Intl rejects degrades to the device clock
  instead of throwing at render. The mini dials now share the same formatter cache.
- **Changed:** `ProductivityClock.tsx`, `FlipClock.tsx`, `WorldClock.tsx`, new `world-time.ts`
  + `world-time.test.ts` (7 cases), the three schemas, `schema-liveness.test.ts` (ledger 6 → 3;
  every face schema is now read). The seven legacy faces remain on FACE_TOKEN_EXEMPT.
- **Verified:** liveness gate red on exactly the three and world-time red on the missing module,
  both green after; 38 files / 479 tests, tsc, lint, check:tokens green. Dev preview face cycle:
  Flip renders white digits, World its red second hand, Productivity its orange, no console
  errors. Not exercised on-glass: the non-default paths (12-hour Flip, a non-local primary
  timezone), which are covered by the pure tests and by construction.
- **Open:** ledger rows for claude-usage, fireplace, github (batch d).

## 2026-09-05 · item 2, batch b: four accent-only faces wired (Square, Floral, Complications Light, Complications Dark)

- **What:** each face now takes `FaceProps`, parses `faceConfig` against its schema with the
  defaults as fallback (AnalogClock pattern), and draws its accent from the parsed value.
- **Defaults aligned to what the face has always drawn**, so an unconfigured instance is
  pixel-identical: `face.square` #22c55e → #e94560 (sub-dial ring + hub), `face.floral`
  #f59e0b → #fbbf24 (hands). Complications Light/Dark already defaulted to their habit-ring
  green #22c55e; only the green is bound to `accent` (the amber weather sub-dial, the light
  face's amber second hand and the dark face's purple second hand are separate decisions and
  stay literal). A saved instance that stored the OLD default will now render that stored
  colour, which is what the admin has been displaying for it all along.
- **Changed:** `SquareClock.tsx`, `FloralClock.tsx`, `ComplicationsLight.tsx`,
  `ComplicationsDark.tsx`, `face.square.ts`, `face.floral.ts`, `schema-liveness.test.ts`
  (ledger 10 → 6). These four stay on FACE_TOKEN_EXEMPT: night tokens are a separate retrofit.
- **Verified:** gate red on exactly the four, green after; 37 files / 472 tests, tsc, lint,
  check:tokens green. Dev preview (5181): cycled the clock faces via the registered swipe
  callback; Complications Dark, Complications Light, Floral and Square each rendered with their
  default accent present in the DOM; no console errors.
- **Open:** ledger rows for productivity, world, flip (batch c) and claude-usage, fireplace,
  github (batch d).

## 2026-09-05 · item 2, batch a: four schemas wired (Agents, Breathing, Date, Temperature)

- **What:** the four mechanical rows of SCHEMA_UNREAD. Each component now value-imports its
  schema and reads config through `schema.safeParse(config ?? {})` with the schema defaults as
  the fallback (the Calendar pattern, decision D4). Behaviour unchanged for valid config;
  malformed config now yields the defaults instead of partially-filtered raw fields.
- **Changed:** `src/apps/agents/AgentsApp.tsx` (enabledAgents / defaultAgent via
  `agentsAppSchema`), `src/apps/breathing/BreathingApp.tsx` (showDistance via
  `breathingAppSchema`, the raw `as Partial<T>` cast is gone),
  `src/shared/complications/Date.tsx` and `Temperature.tsx` (mixed value+type imports,
  safeParse). `schema-liveness.test.ts`: ledger 14 → 10.
- **Verified:** ledger rows removed first, gate red naming exactly the four; green after the
  wiring. 37 files / 472 tests, tsc -b, lint green.
- **Open:** ledger rows for 7 legacy faces + claude-usage, fireplace, github (batches b to d).

## 2026-09-05 · item 1: baseline debt paid, NAV-1 promoted to blocker (branch `claude/agentic-design-system-arch-ac2da8`)

- **What:** the five BASELINE rows from option 2 are fixed and deleted; the baseline is empty
  and documented as the steady state. NAV-1 is now a `blocker`.
- **Changed:** `AgentsApp.tsx` and `WeatherApp.tsx` adopt HabitsApp's exact shape (inactive
  branch nulls, captured `cb`, cleanup nulls only if the slot is still ours).
  `src/admin/lib/array-fields.tsx`: the list-editor input gains
  `focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]` (neither the input nor its row
  had any focus treatment). `TodoApp.tsx`: `border-[3px]` becomes Tailwind v4's `border-3`
  (compiles to the same 3px, verified in both built CSS bundles). `src/admin/routes/Apps.tsx`:
  the instance-count pill snaps from `text-[10px]` to `text-xs` (12px; the only visual change,
  admin-only). `rules/superclock.json`: NAV-1 severity blocker, provenance note.
  `rulecheck-tree.test.ts`: BASELINE = {}. `AGENTS.md` Known-gaps bullet rewritten.
  `.claude/launch.json`: new `dev-alt` config on 5181 so a worktree can preview while another
  session holds 5180 (5180 was held by a vite for pegbo-proto-starter, left running).
- **Verified:** tree gate red with exactly the five rows after emptying the baseline, green after
  the fixes; gates.sh green (lint, check:tokens, 37 files / 472 tests, build). Dev preview on
  5181: Weather → Habits → Weather → Todo via `window.__nav` + `finishTransition()`, the
  swipe slot stayed registered after every transition, mode returned to `app`, no console errors.
  Not exercised: Agents' per-agent view registration (needs an in-app tap; same shape as
  Weather), the Todo row (list empty in dev, covered by the CSS check), keyboard focus on the
  admin input (hidden tab cannot deliver keyboard focus).
- **Open:** none for this item.

## 2026-09-05 · option 2: rule catalogue + runner (branch `claude/agentic-design-system-arch-ac2da8`)

- **What:** every design rule is one record with its severity and its detector, in
  `rules/superclock.json` (25 rules: 7 grep, 5 heuristic, 3 requires, 4 judgment, 3 rendered,
  3 delegated; 19 blocker / 4 review / 2 warning; 8 exemptions, each with a reason). Judgment
  and rendered rules print as unchecked on every run instead of silently passing (one-accent
  FCE-1, LVGL parity FCE-2, honest offline CPY-4, states STA-1, contrast STA-5, 375px STA-7,
  circle crop KIO-2); delegated rules name the gate that enforces them (SYS-1 and FCE-3 the
  token gate, KIO-3 the ESLint clock setInterval ban).
- **Changed:** `scripts/rulecheck.mjs` (harvested from design-system-rebuild, stdlib only,
  comment-stripping; three pinned extensions: `requires` co-occurrence, exemptions as
  { path, reason }, `delegated`; single-file mode prints findings only). `scripts/lib/rule-schema.mjs`
  (zod, ported from the ds-architecture starter kit). Tests: `rulecheck.test.ts` (engine
  claims + CLI), `rule-catalogue.test.ts` (schema, compile, fix, exemption reasons, every
  mechanical rule fires on `<id>-bad.tsx` and stays quiet on `<id>-good.tsx`),
  `rulecheck-tree.test.ts` (policy: zero tolerance off the baseline, two-way baseline).
  33 fixtures under `scripts/lib/__fixtures__/rules/`. `npm run check:rules`. Hook
  `.claude/hooks/check-tokens-on-edit.sh` also runs blocker rules on the edited file
  (advisory). `AGENTS.md`: command, Conventions bullet, Known gaps rewritten (two bullets
  replaced), Gestures pointer, one new trap. `unslop/SKILL.md` Phase 2 points at check:rules.
- **Tree at freeze:** 0 blockers; baseline debt NAV-1 x2 (AgentsApp, WeatherApp: unconditional
  null of the shared slot), STA-3 x1 (array-fields.tsx:262), LAY-4 x2 (TodoApp border-[3px],
  Apps.tsx text-[10px]). Sanctioned exemptions: COL-4 QuickSettings sheet + admin sticky
  header; MOT-1 SwipeContainer Suspense spinner + breathing/fireplace/clock ambient carve-out;
  LAY-4 vendored shadcn ui/; KIO-1 useCalendarEvents (gated through `enabled`).
- **Verified:** `./scripts/gates.sh` green: lint, check:tokens, 37 files / 472 tests, build.
  Engine claims red before the runner existed (missing module), green after; the CLI footer
  test was red before the suppression, green after. Hook pipe-tested: blocker probe prints the
  finding, a review-only file stays silent, an ungated file stays silent, exit 0 throughout.
- **Found along the way:** `useCalendarEvents.ts` mentions isActive only in a doc comment
  while gating through `enabled`; a raw grep read it as gated, the comment-stripping runner
  did not. Recorded as a KIO-1 exemption and a trap in AGENTS.md.
- **Decisions:** ci.yml and gates.sh unchanged on purpose: the CLI exits 1 on any hit
  (baseline debt included), so policy lives in `npm test`. Severity is earned: NAV-1 ships at
  review and is promoted to blocker when Agents and Weather adopt the HabitsApp guard.
- **Open:** the five baseline rows (each a small app or admin change with its own review);
  options 3 to 7 from the gap analysis, awaiting Nick.

## 2026-09-05 · option 1: schema-liveness gate (branch `claude/agentic-design-system-arch-ac2da8`)

- **What:** the consumption half of the registry contract. `src/shared/schema-liveness.test.ts`
  requires every declared app/face/complication schema to be value-imported by the component
  that owns it (Calendar pattern, `schema.safeParse(config ?? {})`), or to sit on
  `SCHEMA_UNREAD`, a shrink-only ledger with a reason per row. Two-way: a row whose schema
  became read fails as stale. `import type` does not count.
- **Changed:** new `src/shared/schema-liveness.test.ts` (ledger frozen at 14 of 27: apps
  agents, breathing, claude-usage, fireplace, github; faces productivity, square, floral,
  complications-light, complications-dark, world, flip; complications date, temperature).
  `scripts/lib/scaffold-templates.mjs`: app and face templates now import and safeParse their
  schema (born schema-live); `scaffold-templates.test.ts` pins it. `AGENTS.md`: gate
  described next to coherence/contract, scaffolder lines updated.
- **Verified:** empty ledger went red on the real tree naming the 12 app/face schemas; the
  widened gate adds the 2 complication renderers (type-only imports, mounted nowhere, D2).
  A temporary copy with a stale `app.calendar` row failed on exactly the stale-row test.
  Scaffold smoke (`new:app` + `new:face liveness-smoke`): tsc, lint, check:tokens green;
  the only red tests were the two by-design todo tests and the missing preview art; reverted.
  Clean tree: 34 files / 429 tests, lint, check:tokens green.
- **Decisions:** predicate is a value import (not safeParse presence): honest floor, stated in
  the file header. Complications included rather than declared out of scope, since renderers
  exist. Ledger rows carry the fix direction (Calendar / AnalogClock reference).
- **Open:** the 14 rows themselves (wiring work, each its own change); option 2 next.

## 2026-09-05 · agentic design-system gap analysis (branch `claude/agentic-design-system-arch-ac2da8`)

- **What:** brainstorm-only session. Read the six Design Systems Collective "agentic design
  system" articles (AI-ready DS, agentic DS, structured metadata, codebase index,
  orchestration, encoding governance) and mapped them onto this repo, the July decisions
  record, PR #51/#52, and the sibling repos `design-system-rebuild`, `ds-architecture`,
  `Minimal Design System`.
- **Changed:** no code. Created this file and one pointer line in `AGENTS.md`. Findings also
  in the private memory `agentic_ds_gap_analysis.md`.
- **Verified against the tree (77f742a):**
  - 11 of 25 declared schemas are never read by their component: apps `agents` (raw fields,
    no schema), `claude-usage`, `fireplace`, `github`; faces `productivity`, `square`,
    `floral`, `complications-light`, `complications-dark`, `world`, `flip`. The admin renders
    forms for all of them.
  - 10 apps register `setVerticalSwipeCallback`; `AgentsApp` and `WeatherApp` use an
    unconditional `setVerticalSwipeCallback(null)` instead of the guarded shape AGENTS.md
    mandates. Whether it stomps in practice depends on effect order; not reproduced.
    AGENTS.md's "Users:" list names 7 of the 10.
  - Prose drift: `directive/foundation.md` and `docs/architecture.md` say 11 apps (code: 14);
    `README.md` still documents `VITE_GITHUB_TOKEN` with a mock fallback.
  - False positives worth remembering for any detector: `fitness/useCircuitTimer.ts` IS gated
    (via its `active` param); Claude-usage's offline tell lives in the App, not the hook.
- **Conclusion:** the articles' enforcement layer already exists here (token gate, coherence +
  contract tests, scaffolders, hooks, gates.sh, unslop). Missing are the consumption check
  (is a declared contract read?) and a regenerable report. A TOON index or `.metadata.ts`
  sidecars are not worth it at 14 apps / 13 faces: the registries are the index.
- **Options presented to Nick (awaiting pick):** 1 schema-consumption liveness gate;
  2 rule catalogue + stdlib runner (port `design-system-rebuild` `rules/` + `rulecheck.mjs`);
  3 capability contract on `AppMetadata` (adds missing audio/mic/radar FeatureFlags);
  4 AGENTS.md drift gate; 5 regenerable health report; 6 path-scoped rules split;
  7 deliberately skip index/instance-count/sidecar metadata. Recommended 1 then 2.
- **Open:** Nick's pick. Each pick gets its own brainstorm classification before any code.
