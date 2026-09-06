# Agent log

What each agent session did to this repo, newest first. Read it before starting work. Append an entry at the end of every work chunk, not only at session end. Entries are factual: what changed (file paths), what was verified and how, decisions taken, what is still open. Never rewrite an older entry; add a new one that corrects it.

Work on this repo lands as local code changes. Do not open or wait on pull requests unless Nick asks for one.

---

## 2026-09-06 · branch claude/project-brainstorming-e32502 · design-system step 3: face and widget contracts built

**Changed:**
- `src/shared/part-meta.ts` (new): `faceMetaSchema`/`widgetMetaSchema` (zod), `SPEC_PENDING` (shrink-only, 6 entries), `resolveSpecColor`, `specOf`. `src/shared/part-meta.test.ts` (new, 155 lines): fixture coverage for every field and gate, including every schema rejection reason.
- `src/shared/part-contracts.test.ts` (new): the real-tree gate (R16), one check per row of the spec's gates table: meta validity, one meta per part, every claim (night tokens, option keys, parity path, `insteadUse`), geometry state, and structural read for a face carrying `spec`.
- Fifteen meta files (new), one per part: thirteen faces (`src/apps/clock/{MinimalismoClock,AnalogClock,ProductivityClock,SquareClock,FloralClock,ComplicationsLight,ComplicationsDark,WorldClock,FlipClock,DepletionClock,ApertureClock,DaylightClock,StrokesClock}.meta.json`) and two widgets (`src/core/widgets/RoundList.meta.json`, `src/apps/agents/StateRing.meta.json`). `scripts/lib/token-rules.d.mts` (new): hand-kept types so the contract test can import `token-rules.mjs` under strict `src/` typechecking.
- `src/apps/clock/AnalogClock.tsx` + `AnalogClock.meta.json`: Analog now draws every hand, tick and dot number from `meta.spec`; the numeral ring radius (340) stays a literal on purpose, outside the spec vocabulary.
- `src/apps/clock/MinimalismoClock.tsx` + `MinimalismoClock.meta.json`: the same move, six numbers and the gold second-hand colour.
- `scripts/lib/lvgl-parity.mjs`/`.d.mts`, `scripts/lib/lvgl-parity.test.ts` (new, fixtures), `src/shared/lvgl-parity.test.ts` (new, real tree): `parseGeom`/`parseColors` read `slow-native/src/clock_face.c`, `compareToSpec` diffs it against the Analog spec, `PARITY_DRIFT_LEDGER` names the 9 known mismatches.
- `scripts/lib/parts-index.mjs`/`.d.mts`, `scripts/build-index.mjs`, `index/parts.toon` (new, 15 rows), `scripts/lib/parts-index.test.ts` (fixtures), `src/shared/parts-index.test.ts` (new, drift gate, R17). `package.json`: `build:index` script.
- `scripts/lib/scaffold-templates.mjs` (`faceMetaTemplate`), `scripts/new-face.mjs`, `scripts/lib/scaffold-templates.test.ts`: `npm run new:face` now writes a `TODO`-stubbed meta alongside the component, so a scaffolded face is red on the contract gate until its judgments are filled in, the same way its todo test is red until implemented.
- `scripts/lib/rules.mjs`: R10 gains `checkedBy: src/shared/lvgl-parity.test.ts`; new R16 (`src/shared/part-contracts.test.ts`) and R17 (`src/shared/parts-index.test.ts`).
- `AGENTS.md`: a new Conventions bullet ("Parts carry contracts"), the LVGL parity line corrected from "currently Minimalismo" (doc drift, recorded in the previous entry) to Analog, and the Known-gaps R09/R10 bullet rewritten to say R09 is now declared as data and R10 is gated.
- `docs/superpowers/specs/2026-09-05-face-contracts-design.md`: changelog line for this implementation.

**Verified:** `./scripts/gates.sh` green end to end: lint clean; check:tokens (47 semantic-zone files and 13 faces clean, 7 legacy faces exempt, 7 tokens ledgered, 6 rules with no detector: R09, R11, R12, R13, R14, R15; R10 is no longer among them); 504 tests across 42 files; both-SPA production build, `build-info.json` stamped `fed4d1c`.

Mutation-checked four of the new gates, each file restored to its committed state afterward and the full suite re-run green (504/504): a phantom night token added to `AnalogClock.meta.json` fails `part-contracts.test.ts`, naming the part, the token, and the file that does not read it; deleting the `radius` line from `PARITY_DRIFT_LEDGER` fails `lvgl-parity.test.ts` as an unledgered drift, printing the exact react/lvgl values; hand-editing one field of the `analog` row in `index/parts.toon` fails `parts-index.test.ts` with a line-level diff against a fresh emit; re-adding `analog` to `SPEC_PENDING` (it now carries `spec`) fails `part-contracts.test.ts`, naming the face and telling you to delete its SPEC_PENDING line.

Pixel identity for Analog and Minimalismo: verified, by two methods instead of the stash-and-diff the plan suggested (stashing is off-limits here, the stack is shared across worktrees). First, analytically: every literal removed from each TSX in Tasks 3 and 4 was traced to the exact meta number it now reads, against the pre-migration source (`git show <parent commit>:<path>`). Second, live: `npm run dev` on port 5180, driving `window.__nav.getState().verticalSwipeCallback('down')` from the browser console to cycle ClockApp from its default face to each target, then reading `document.querySelector('svg').outerHTML`.
- Minimalismo: byte-identical. `handPoints` still receives the same 280/380/350-tip, 80-tail, 6/28/20-width numbers, and the second hand's colour is the same literal `"#FFD700"` string before and after. The only difference between two readings is the hand-angle trig, which moves with real time regardless of this change.
- Analog: every position, width, and the second hand and both dot fills (which resolve through the same `accent` config value either way) match exactly: 60 ticks plus 3 hands render as 63 `<line>` elements, 3 `<circle>` elements, and numerals are off by default so their colour is not in play. The one textual difference is how the ink colour is written: the old tick, hour-hand and minute-hand strokes read `stroke="currentColor"` inherited from a `<g className="text-white">` wrapper (the hands used the literal `"white"` keyword directly); the new code writes the resolved `"#ffffff"` literal on each element and the wrapper class is gone. The rendered colour is identical: `getComputedStyle` on a `color: white` node and a `color: #ffffff` node in the running page both report `rgb(255, 255, 255)`.

**Decisions:**
- The parity ledger carries 9 mismatches between React Analog and the LVGL `clock_face.c`, none fixed here (AGENTS.md: a red check on a deliberate design is a conversation, not a fix-forward; which renderer is right is Nick's call):
  - `face.background`: React draws a black dial, the C a white one.
  - `face.ink`: React ink is white on black, C ink is black on white (follows the background decision).
  - `face.ink.tick`: React draws tick marks in ink (white), the C ticks are black (follows the background decision).
  - `face.ink.minute`: React's minute hand is ink (white), the C minute hand is black (follows the background decision).
  - `radius`: React fills the whole 1000 disc; the C draws a 460 face inside a black backdrop.
  - `ticks.hour.outer`, `ticks.hour.inner`, `ticks.minute.outer`, `ticks.minute.inner`: all four sit 40 units inside the React ticks because the C face radius is 460, not 500.
- Six faces stay on `SPEC_PENDING`, numbers still in the TSX, each its own future change: `productivity`, `square`, `floral`, `complications-light`, `complications-dark`, `world`.

**Found:**
- Task 5's own review round found that `compareToSpec` read the hour hand's colour but never the tick colour or the minute hand's, so a C-only edit to either one would never surface as a mismatch (shown empirically, by mutating each independently). Both checks were added, against the same `spec.face.ink`; two more real mismatches (`face.ink.tick`, `face.ink.minute`) surfaced and are ledgered above, taking the ledger from 7 entries to 9. Neither renderer was touched to chase green.
- The plan's own prescribed code hit the same TypeScript gap three times (Tasks 3, 4, 5): a value read from an optional or nullable field (`spec.hands.second`, `spec.ticks`, `spec.dot`), or from an array element narrowed by `.filter()` (`meta.parity.lvgl`), is not narrowed at the point it is later used, under this repo's strict settings. Each was fixed the same way, checking the raw path again immediately before use, never a cast, never a non-null assertion. Worth remembering before copying this plan's code again.

**Open:**
- Nick's review of the fifteen contract files: their judgments (`purpose`, `accent`, `night.recipe`, `options[].intent`, `antiPatterns`) are drafted from the specs, the archetype study and the board notes; they are proposals until he reads each one.
- Which Analog is right: the black dial with white ticks React draws, or the white dial with black ticks the C file draws. The ledger holds the mismatch either way; nothing here leans toward one.
- StateRing's eventual home, `src/apps/agents/` or alongside RoundList in `src/core/widgets/`. The contract works from either location; moving the file is a separate refactor.

---

## 2026-09-05 · branch claude/project-brainstorming-e32502 · design-system step 3: face and widget contracts, spec written

**Changed:** `docs/superpowers/specs/2026-09-05-face-contracts-design.md` (new, 171 lines). Docs only; nothing built, nothing committed.

**Decisions (Nick):** option 2 of three, judgments plus numbers: a `.meta.json` beside every face and kiosk widget carrying the placement judgments, and for hand-and-tick faces the numbers the face is drawn from; the TSX reads its numbers from the file; a parity test diffs the LVGL C constants against the Analog spec; an emitted index and one AGENTS.md rule make the files the first read. Analog and Minimalismo migrate first, the rest on shrink-only lists. Admin surface contracts wait for the Admin IA v2 branch.

**Found while framing:** `slow-native/src/clock_face.c` on main is the Swiss-railway Analog face (ticks, dot, white face, no night palette), not Minimalismo; PR #22 (LVGL night palette) is closed unmerged; React Analog draws a black face with white ticks. AGENTS.md's "currently Minimalismo" is doc drift. The parity gate in the spec is what pins this; which Analog is right is Nick's call, ledgered until made.

**Plan:** spec approved by Nick as written; `docs/superpowers/plans/2026-09-05-face-contracts.md` (new, 8 tasks, TDD, every file's code inline) is the executable form. Task order: schema and helpers; the contract gate plus all 15 meta files (R16); Analog draws from its spec; Minimalismo likewise; the LVGL parity parser, drift ledger and gate (R10 flips to checked); the emitted index with drift gate (R17); the scaffolder meta stub; AGENTS.md rule and this log.

**Open:** execution not started; commits are Nick's call; the 15 judgment drafts inside the plan are proposals until Nick reads them.

---

## 2026-09-05 · branch claude/project-brainstorming-e32502 · design-system step 1: token liveness gate + rule catalog

Approved by Nick as the first of three moves (1 gates, then 3 usage contracts as the face-spec brainstorm, then 2 token axes). Built test-first; nothing committed at the time of writing.

**Changed:**
- `scripts/lib/token-liveness.mjs` (new): fs-free predicates (`declaredTokens`, `stripDeclarations`, `readerPattern`, `findReaders`, `auditLiveness`) and `UNCONSUMED_LEDGER`, a shrink-only list of tokens declared on purpose but read by nothing, 7 entries with reasons. `scripts/lib/token-liveness.d.mts` (new): types so `src/` can import the `.mjs` under strict tsconfig. `scripts/lib/token-liveness.test.ts` (new): 15 fixture tests.
- `src/shared/token-liveness.test.ts` (new): the real-tree gate. Every token declared in `src/index.css` and `src/admin/index.css` has a reader somewhere in `src/` or a ledger entry; a ledger entry whose token gained a reader, or is no longer declared, fails as stale. Same shape as `registry-contract.test.ts`.
- `scripts/lib/rules.mjs` (new): the rule catalog, R01 to R15, one record per rule with `statement`, `why`, and either `checkedBy` (8 rules: npm script or vitest file) or `unchecked` (7 rules: what would check it, who enforces it meanwhile). `scripts/lib/rules.test.ts` (new): 8 meta-tests; a `checkedBy` that names no real script or test file fails.
- `scripts/check-tokens.mjs`: prints the ledger count and the unchecked rules at the end of every run, on failure too.
- `AGENTS.md`: Known gaps opens with the catalog and ledger pointer; the review-enforced bullet carries its rule ids (R09, R10).

**Verified:** `./scripts/gates.sh` green end to end: lint, check:tokens (47 semantic-zone files, 13 faces, 7 ledgered tokens, 7 unchecked rules printed), 446 tests across 36 files, both-SPA build. Each test was watched red before its implementation: module missing first, then the real-tree gate red on exactly the 7 dead tokens the audit below had found. Mutation-checked with every file restored afterward: a phantom `checkedBy` path fails `rules.test.ts` naming the path; a new dead `--color-orphan` in `src/index.css` fails the tree gate naming the token; a ledger entry for a token that has a reader fails as stale.

**Decisions:**
- The 7 dead tokens are ledgered, not deleted, so nothing changes on glass and the list shrinks under step 2: `--color-temp-high`, `--color-temp-low` (WeatherApp never adopted them; wire or delete is a weather design call), admin `--accent`, `--accent-foreground`, `--input`, `--popover-foreground`, `--radius` (unreachable while `src/admin/index.css` has no `@theme inline` block).
- What counts as a reader: the token inside parentheses anywhere in `src/` (covers `var(--x)` and Tailwind's `bg-(--x)`, which Quote, Depletion and Daylight use), plus for kiosk `@theme` names the utility Tailwind derives (`bg-accent`, `font-family-display`). CSS declaration lines never count, tests never count, reads inside comments do count (known, under-reports rather than trusting a comment stripper).
- Left out on purpose: meta-claim checks (no meta files until step 3), a `tokens.ts` name contract (no design-tool sync here), the ds-architecture config file.

**Found:** `src/apps/breathing/BreathingApp.tsx:79` uses `font-display`, which Tailwind v4 does not derive from `--font-family-display` (that name yields `font-family-display`), so the class is a no-op today, hidden because `body` already sets Inter. Fix when Breathing is next touched.

**Open:** commit is Nick's call. Next is step 3, usage contracts (a `.meta.json` per widget, admin surface and face, a routing index, a shipped skill doc), which doubles as the face-spec-as-data brainstorm; step 2 (token axes) after the admin IA v2 branch is merged locally.

---

## 2026-09-05 · branch claude/project-brainstorming-e32502 · orientation + design-system audit

**Changed:** `docs/agent-log.md` (this file, new), `AGENTS.md` (one-line pointer to this log). No source changes. Nothing committed at the time of writing.

**Verified:** docs only, so no gates were run. Fleet state below was read live from `/api/health` and `tailscale status`; token numbers come from greps over `src/`, listed so the next session can re-run them.

**Fleet state (read 2026-09-05):**
- fastclock: reachable (LAN 192.168.4.30, tailnet 100.78.29.28). Running branch build `34af264` (`claude/verifiable-deploys`, built 2026-08-08), 67 commits behind `main` (`77f742a`), up 29 days. Kiosk shows Minimalismo.
- squareclock: reachable (LAN 192.168.4.44). `/api/health` has no build stamp, so it runs a build older than the stamp work; commit unknown.
- smallclock: tailnet says offline 5 days. slowclock: offline 88 days.
- Every `superclock-*/device.json` IP is stale (fast says .28, square says .22); small and slow are TBD stubs. `CLOCK_SPECS.txt` disagrees with them. Neither file is read by code.
- Local dev port 5180 was held by another project's Vite server (pegbo-proto-starter, PID 79318, up 3 days). `npm run dev` here cannot bind until that is stopped or the launch config uses another port.

**Repo state:** `main` equals `origin/main` at `77f742a`. Open PRs at the time: #52 (Admin IA v2 P1, 45 files, mergeable, blocked only on an on-glass check) and #53 (RoundList + Todo component tests, mergeable). CI green on main 13 days earlier. Both are branches to merge locally if wanted; see the no-PR rule above.

**Open defects from `docs/decisions/2026-07-24-concept-adjudications.md`, re-checked:**
- Single-app swipe wedge: fixed and pinned (`src/core/navigation.test.ts:68`).
- `settings.presence` still absent from the strict schema in `src/shared/device-config-schema.ts` while `src/shared/types.ts:91` declares it and `PresenceShade.tsx` + `server/display-adapter.ts` read it. Likely still breaks the settings PATCH once a device carries the key; not re-tested.
- `noteUserGesture` is now called only from `src/core/components/QuickSettings.tsx`. Calendar paging and face cycling still do not stamp it, so playlist rotation can still interrupt them.
- 3-finger pointer set in `src/core/hooks/useGestures.ts` still has no reset on `blur` or `visibilitychange`.
- `README.md` lists 10 apps (14 registered) and still documents `VITE_GITHUB_TOKEN` (token moved server-side).

**Design-system audit (kiosk `src/index.css`, admin `src/admin/index.css`):**
- Kiosk declares 13 custom properties. Zero readers anywhere in `src/` (no `var()`, no utility): `--color-temp-high`, `--color-temp-low`. Live: `--color-accent` (8 `var()` reads), `--face-ink` (15), `--face-ink-muted` (5), `--face-bg`, `--face-tick`, `--face-plate`, `--face-dusk` (2 each), `--face-spent`, `--face-ghost` (1 each), `--color-sheet` (1, via `bg-sheet`), `--font-family-display` (body rule + 1 utility).
- Admin declares 23. Zero `var()` reads in `src/admin`: `--accent`, `--accent-foreground`, `--input`, `--popover-foreground`, `--radius`. `--foreground` is read only by the `.admin-root` rule itself. There is no `@theme` or `@theme inline` block, so shadcn utilities such as `hover:bg-accent`, `border-input`, `rounded-lg` cannot resolve to these tokens; that is why they are dead. Admin border-color utilities are dead for a second reason already recorded in AGENTS.md (unlayered reset).
- Motion: no motion tokens. Inline framer literals in 3 kiosk files (`duration: 0.8`, `0.3`, `0`, `ease: 'easeInOut'`). No `prefers-reduced-motion` handling anywhere.
- Admin raw Tailwind steps (grep counts over `src/admin/**/*.tsx`): 137 spacing, 43 radius, 4 shadow, 10 pinned control heights (`h-8`…`h-12`). No spacing, elevation or radius roles.
- Component usage contracts: none. No `.meta.json`, no routing index, no shipped skill doc. `src/core/widgets/` holds one widget (`RoundList.tsx`).
- The `ds-architecture` conformance ladder (`/Users/nickv/ClaudeCode Projects/ds-architecture`, `node scripts/conformance.mjs <repo>`) exits "could not tell" on this repo: it needs a `ds-architecture.config.json` at the repo root (profile, adoption, scopeRoles, paths, axes, commands). Not written, pending the decision below.

**Newer design-system moves not yet absorbed here** (from design-system-rebuild through 2026-09-05 and ds-architecture 2026-08-22; PR #51 on 2026-08-14 already ported the token gate, scaffolders, contract gate, gates.sh, hooks and unslop):
1. Token liveness walk: declaration, then alias, then a component that reads it; a declared `unchecked` ledger for rules no script can run; rule and detector as one record.
2. Token axes: three-tier globals with an `@theme inline` block for the admin, a device axis for the kiosk (round 1080, round 800, square 800x480), motion tokens with reduced-motion, spacing and elevation roles instead of raw steps.
3. Usage contracts: a `.meta.json` per widget, admin surface and face (variant intent, state recipes, anti-patterns with the why), a routing index, a shipped skill doc. For faces this is the pending face-spec-as-data brainstorm.

**Decisions taken this session:**
- Work lands as local code changes, no PRs (Nick, 2026-09-05).
- This log exists; shape approved by Nick (path, entry fields, per-chunk cadence).

**Open:** Nick has not yet picked which move goes first (1 gates, 2 token axes, 3 usage contracts, or all in ladder order). Recorded recommendation: 1 now, then 3 as the face-spec brainstorm, 2 after the admin IA v2 branch is merged locally so it does not conflict with those 45 files. Fleet redeploy to `main` is a separate, unpicked item.
