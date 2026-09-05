# Agent log

Newest entry first. Several agent sessions work this repo in parallel worktrees and
there are no PRs to hand work over, so this file is the handoff surface. Append an
entry before finishing a chunk of work, not only at session end. Each entry says:
what changed, which files, what was verified, decisions taken, what is still open.

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
