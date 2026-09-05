# Agent log

Newest entry first. Several agent sessions work this repo in parallel worktrees and
there are no PRs to hand work over, so this file is the handoff surface. Append an
entry before finishing a chunk of work, not only at session end. Each entry says:
what changed, which files, what was verified, decisions taken, what is still open.

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
