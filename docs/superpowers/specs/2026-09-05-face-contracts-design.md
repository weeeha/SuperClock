# Face and widget contracts: design

**Date:** 2026-09-05
**Status:** Approved direction (Nick, this session): option 2, judgments plus numbers. Section-level design approved; this document is the written form for review.
**Source:** design-system step 3 of the 2026-09-05 brainstorm (step 1, the token liveness gate and rule catalog, is built). Ported ideas: the component usage contract from `design-system-rebuild` (`.meta.json` per component, judgments not props, anti-patterns with the why, claims gated against source) and the liveness and declared-drift moves from `ds-architecture`. Repo intent it serves: `directive/foundation.md` non-negotiable 6 (faces are data, target state), `docs/decisions/2026-07-24-concept-adjudications.md` D3 (the shared face spec comes after the primitive kit; this is its first slice), rule catalog R09 and R10.
**Handoff:** `docs/agent-log.md` carries the session record; the implementation plan follows this spec.

## TL;DR

Every face and kiosk widget gets a co-located `.meta.json`: the judgments a designer applies when placing or changing it, written down so an agent does not infer them, plus, for hand-and-tick faces, the numbers the face is drawn from. Gates check every claim against the source. The face TSX reads its numbers from the file; a parity test diffs the LVGL C constants against the same file, which turns R10 from a review item into a detector. An emitted index and one AGENTS.md rule make the contracts the first thing an agent reads. Analog and Minimalismo migrate first; the rest sit on shrink-only lists so day one is green and every gap is named.

## Problem

The judgments that make a face right live in the author's head and in specs that have already drifted from the tree. AGENTS.md says the face shared with the LVGL renderer is Minimalismo; the C file on main is the Swiss-railway Analog face. React Analog draws a black face with white ticks; the C draws a white face with black ticks; nothing says so. The one-accent rule (R09) and LVGL parity (R10) are review-enforced, so a session that never read the three-faces study can add a second accent and pass every gate. An agent placing RoundList has to open the component to learn that the empty state is required. Each of these is the same gap: a decision that exists but is not written where the machine, or the next session, looks.

## Users and the job

- **Primary:** an agent session in this repo about to add a face, change a face, or place a widget. Job: know what this part is for, what it must never do, and which numbers it is drawn from, before touching it.
- **Secondary:** whoever maintains `slow-native/src/clock_face.c`. Job: learn from a test, not a diff, when the C constants disagree with the React face.
- **Later, not designed for here:** community contributors authoring a face as a file (foundation horizon 3), and the admin gallery reading purpose text.

## Approach

One `<Component>.meta.json` beside each face component in `src/apps/clock/` and beside each kiosk widget, validated by a zod schema in `src/shared/part-meta.ts`. A face file carries judgments (purpose, the accent claim, the night recipe, what each option is for, anti-patterns with the why, parity) and, when the face is drawn from hands and ticks, a `spec` block of numbers in the 1000-unit render space the components and the C struct already share. The TSX imports the file and draws from `spec`; a parity test parses the C initializer and diffs it against the Analog spec; an index is emitted from the files; the scaffolder emits a stub that fails the gate until filled.

### Alternatives considered

| Option | Tradeoff | Why not |
|---|---|---|
| 1. Judgments only | Cheapest; React stays the renderer | R10 stays a review item and community faces stay pull requests; the drift found today would stay invisible |
| 3. Whole face as data, one engine per renderer | The horizon-3 answer, community faces as files | Rewrites how 13 faces render; Strokes, Floral and the Complications faces do not fit hand-and-tick primitives; D3 sequenced it after the primitive kit. Option 2's numbers block is designed to grow into it |

## The file

Filename: `src/apps/clock/<Component>.meta.json` next to `<Component>.tsx`; widgets: `src/core/widgets/RoundList.meta.json`, `src/apps/agents/StateRing.meta.json`. Judgments, never restated props: TypeScript already states the props.

### Face (`kind: "face"`)

| Field | Carries | Gate |
|---|---|---|
| `id` | the registry id | equals the id in `FACE_COMPONENTS` that maps to this component file |
| `purpose` | what the face is for and what it refuses to be, prose (40+ chars) | present; no string in the file may begin with `TODO` |
| `accent` | `null` when the face has no saturated quantity, else `{ where, color }`: where it sits, and its colour as a `--face-*` or `--color-*` token, one `#rrggbb` literal, or `config:<optionKey>` | a `config:` key must exist in `options`; exactly one object encodes the one-accent rule as data (R09's rendered check stays unchecked) |
| `night` | `{ recipe, tokens }`: the recipe in prose (20+ chars) and the `--face-*` tokens read | every listed token is read in the TSX; a face not in `FACE_TOKEN_EXEMPT` lists at least one (mirrors R03) |
| `options[]` | `{ key, intent }` per schema key: the judgment that picks a value (20+ chars) | keys equal the face schema's keys, both directions; `[]` for a face with no `configSchemaId` |
| `antiPatterns[]` | `{ rule, why }`, at least one, why 20+ chars | present |
| `parity` | `{ lvgl: null }` or `{ lvgl: "slow-native/src/clock_face.c" }` | the path exists; a face claiming parity must carry `spec` |
| `spec` or `specless` | the numbers block, or a reason (20+ chars) the face has no hand-and-tick geometry (lattices, digits, arcs) | exactly one, unless the face is on `SPEC_PENDING` (below), which allows neither |

### Widget (`kind: "widget"`)

| Field | Carries | Gate |
|---|---|---|
| `id` | kebab id (`round-list`, `state-ring`) | unique across parts |
| `purpose` | prose, 40+ chars | present, no `TODO` |
| `tokens[]` | the tokens the widget reads | each is read in the TSX; `[]` allowed (RoundList reads none) |
| `states[]` | `{ state, recipe }`, at least one | present |
| `antiPatterns[]` | `{ rule, why }`, at least one | present |
| `insteadUse[]` | other part ids to reach for first, optional | each names an existing part |

### The numbers block (`spec`)

Render space is 1000 units, the SVG viewBox side every face uses; lengths are from the centre, widths are stroke widths, all integers. Colours are token names, `#rrggbb`, or `config:<key>`. The C struct `geom_t` in `clock_face.c` is the same vocabulary under other names, listed in the last column.

| Field | Meaning | C twin |
|---|---|---|
| `space` | always `1000` | `viewport_px / 1000` scale factor |
| `face.background`, `face.ink` | the two face tokens | `set_style_bg_color(face)`, hand and tick colour |
| `hands.hour`, `hands.minute`, `hands.second?` | `{ tip, tail?, width, color? }`; tail defaults to 0, colour defaults to `face.ink` | `hour_fwd`, `min_fwd`, `sec_fwd`, `sec_back`, `hour_w`, `min_w`, `sec_w`, `COLOR_GOLD` |
| `ticks` | `null`, or `{ hour: { inner, outer, width }, minute: { inner, outer, width } }` | `hour_tick_inner/outer/w`, `min_tick_inner/outer/w` |
| `dot` | `null`, or `{ outer, inner, outerColor?, innerColor? }` | `dot_outer`, `dot_inner` |
| `radius` | the face circle radius (React draws 500; the C draws 460 inside a black parent) | `face_r` |

Analog is the full case. Minimalismo is `hands` only with `ticks: null`, `dot: null`.

## Who reads it

1. **The face TSX.** `import meta from './Analog.meta.json'`, parsed once at module scope with the zod schema (`resolveJsonModule` is on under this tsconfig), then every hand, tick and dot number comes from `meta.spec`. Structural: a migrated face has no hand literals left to drift.
2. **The parity test** (`src/shared/lvgl-parity.test.ts`). A pure parser in `scripts/lib/lvgl-parity.mjs` reads the `geom_t` initializer (`.hour_fwd = (int32_t)(280 * s)`) and the colour calls out of `clock_face.c`; the test maps them onto the Analog `spec` and lists every mismatch. `PARITY_DRIFT_LEDGER` (shrink-only, next to the parser) names the mismatches known today with a reason each; a mismatch not in the ledger fails, and a ledger entry that no longer mismatches fails as stale. Day one is green with the ledger full; emptying it is a palette decision for Nick, not a fix-forward.
3. **The index** (`index/parts.toon`). `npm run build:index` emits one row per part: kind, id, path, accent, parity, geometry state (`spec`, `pending`, `specless`), first sentence of purpose. A test emits it in memory and fails when the committed file differs.
4. **The scaffolder.** `npm run new:face` also writes `<Component>.meta.json` from a template whose strings begin with `TODO`; the contract gate rejects them, so the face is red until its judgments are written, the same way its todo test keeps it red until implemented.
5. **The agent.** One rule in AGENTS.md: before adding or changing a face or widget, read `index/parts.toon`, then the part's `.meta.json`; the meta is the contract, the TSX is the implementation; run `npm run build:index` after editing a meta.

## Shrink-only lists

Two lists keep day one green without hiding anything, the same shape as `FACE_TOKEN_EXEMPT` and `UNCONSUMED_LEDGER`.

- `SPEC_PENDING` in `src/shared/part-meta.ts`: faces whose numbers still live in the TSX. Analog and Minimalismo are not on it; the other hand-and-tick faces are. A face on the list carries neither `spec` nor `specless`; when its numbers move into the file, its line is deleted. A listed face that already carries `spec` fails as stale.
- `PARITY_DRIFT_LEDGER` in `scripts/lib/lvgl-parity.mjs`: the React-versus-C mismatches known today (at least: face background black versus white, tick colour, radius 500 versus 460, the inner dot colour), each with a reason. Resolving one means deleting its line in the same change that fixes the renderer.

## Gates

| Gate | Fails when | Where |
|---|---|---|
| Meta validity | a file does not match the schema, or any string begins with `TODO` | `src/shared/part-contracts.test.ts` |
| One per part | a component in `FACE_COMPONENTS` or the widget list has no meta, or a meta names no component | same |
| Claims | a night token is not read by the TSX; option keys differ from the schema; a `config:` accent names a missing key; a parity path is missing; a widget token is not read; `insteadUse` names nothing | same |
| Geometry state | a face has both `spec` and `specless`, or neither while off `SPEC_PENDING`, or is on the list with `spec` | same |
| Migrated faces read structurally | a face carrying `spec` whose TSX does not import its meta (Analog and Minimalismo on day one) | same |
| Parity | a C constant differs from the Analog spec without a ledger entry, or an entry no longer differs | `src/shared/lvgl-parity.test.ts` |
| Index in sync | the committed `index/parts.toon` differs from a fresh emit | `src/shared/parts-index.test.ts` |
| Scaffold template | the emitted meta stub is rejected by the gate for the `TODO` reason and no other | `scripts/lib/scaffold-templates.test.ts` |

Rule catalog changes: R10 gains `checkedBy: src/shared/lvgl-parity.test.ts`; new R16 (part contracts and their claims, `src/shared/part-contracts.test.ts`) and R17 (index in sync, `src/shared/parts-index.test.ts`). R09 stays unchecked: the meta declares the accent, the rendered pass still does not exist.

## Key decisions

| # | Decision | Choice | Why | Alternative |
|---|---|---|---|---|
| 1 | Where the numbers live | in the meta, read by the TSX | one source the C parser can also read; a migrated face cannot drift by construction | numbers stay in TSX and the meta restates them (two copies, the fabrication risk) |
| 2 | First faces to migrate | Analog, then Minimalismo | Analog is the face the C file mirrors, so parity is testable on day one; Minimalismo is six numbers and one colour | Minimalismo first (the doc said it was the shared face; the tree says otherwise) |
| 3 | Faces without hand geometry | `specless` with a reason, permanent | Strokes, Floral and the digit faces are lattices, digits and arcs; forcing them into hands would fabricate | put them on the pending list forever (a list that never shrinks is a silence) |
| 4 | Drift found on day one | ledgered, shrink-only, never auto-fixed | AGENTS.md: a red check on a deliberate design is a conversation; which Analog background is right is Nick's call | fix the C to match React in this program |
| 5 | Accent as data | one object or `null`, colour named | encodes the one-accent rule where the scaffolder and the index can see it | free-text field (unparseable) |
| 6 | Index format | TOON rows, emitted, drift-gated | the format the newer repos trained agents on; one row per part is the survey, so no session greps components to choose | a markdown table (readable, but hand-kept) |
| 7 | Widgets | RoundList and StateRing now, same file, no numbers | they are the first two kit consumers and the pattern must hold for non-faces | faces only (the index would lie about coverage) |
| 8 | Admin surfaces | deferred until the Admin IA v2 branch is merged locally | their contracts would describe screens that branch replaces | write them now against `src/admin` on main |

## Constraints

- Work lands as local changes, no PRs (Nick, 2026-09-05). TDD throughout; `./scripts/gates.sh` green before "done"; each new gate mutation-checked.
- `verbatimModuleSyntax`, `erasableSyntaxOnly`, strict tsconfig; JSON imports typecheck (`resolveJsonModule: true`).
- The scaffolder stays transactional: a drifted anchor aborts with nothing written.
- A face's look is the product: no palette or geometry changes to turn a gate green.
- The kiosk runs for weeks on a Pi: the meta is parsed once at module load; nothing new ticks.
- Docs prose: no em dashes, no exclamation marks, plain words.

## Success criteria

- `./scripts/gates.sh` green with all gates above in `npm test`.
- `index/parts.toon` lists 15 parts (13 faces, 2 widgets) and the drift test passes.
- `AnalogClock.tsx` and `MinimalismoClock.tsx` contain no hand, tick or dot literals; both import their meta.
- The parity test names every current Analog mismatch, all of them in the ledger, none silent.
- `npm run new:face -- probe` (then reverted) leaves the contract gate red for the `TODO` reason only.
- `npm run check:tokens` no longer lists R10 as unchecked.

## Out of scope

- A face engine and community JSON loading (option 3). The `spec` vocabulary is its seed, nothing more.
- Admin surface contracts (after Admin IA v2 merges) and the admin gallery reading `purpose`.
- Resolving the Analog drift: which background, radius and dot colour are right.
- Migrating the numbers of the eleven remaining faces; each is its own small change that deletes a `SPEC_PENDING` line.
- Figma variable sync and a `tokens.ts` name contract.
- Moving StateRing into `src/core/widgets` (a refactor; the meta lives where the file is).
- R09's rendered accent check and R11 contrast: still unchecked, still in the catalog.

## Open questions and risks

- **Which Analog is right, black face or white face?** Nick. Until decided, the ledger carries the mismatch. Risk: a session "fixes" one side to green the gate; the ledger's reason text says not to.
- **StateRing's home.** Nick, later; the contract works either place.
- **Judgment drafts.** The 13 face files' judgments are drafted from the specs, the archetype study and the board notes; they are proposals until Nick reads them. Risk: a plausible but wrong anti-pattern becomes law. Mitigation: the human gate is Nick's review of each file, listed in the plan as a checkpoint.
- **The C parser is a regex over one file.** Sufficient for one initializer and a handful of colour calls; it must fail loudly (not report clean) if the initializer moves. Fixture-tested both directions.

## Testing

Fixture tests for the schema (every rejection reason, including `TODO`), for each claim check in both directions (a listed token not read fails; an unlisted token that is read is allowed, the liveness gate covers it), for the geometry-state rules and the stale-list rules, for the C parser (a fixture initializer, a moved initializer, an unknown colour call), and for the index emitter (deterministic output, first-sentence extraction). Real-tree gates as listed. Mutation checks after: plant a phantom token claim, an extra schema key, a changed C constant, an edited index row; each must fail naming the fault.

## Sequence

1. `src/shared/part-meta.ts` schema and `SPEC_PENDING`; fixture tests; the real-tree contract test, red on 15 missing files.
2. Analog meta with `spec`; `AnalogClock.tsx` draws from it. Minimalismo likewise.
3. `scripts/lib/lvgl-parity.mjs` parser, `PARITY_DRIFT_LEDGER`, parity test; R10 flips.
4. The eleven remaining face metas (judgments; `specless` where true; the rest on `SPEC_PENDING`). Nick reviews the judgments.
5. RoundList and StateRing metas.
6. `scripts/build-index.mjs`, `index/parts.toon`, drift test; R17.
7. Scaffolder meta template and its meta-test; R16 recorded.
8. AGENTS.md rule; `docs/agent-log.md` entry; memory pointers.

## Changelog

- 2026-09-05: initial draft from the approved section-level design.
- 2026-09-06: implemented per `docs/superpowers/plans/2026-09-05-face-contracts.md`; meta filenames are `<ComponentFunctionName>.meta.json` (`AnalogClock.meta.json`, not `Analog.meta.json`). Tasks 3, 4 and 5 each hit the same TypeScript gap in the plan's own code: a value read from an optional field, or from an array narrowed by `.filter()`, is not narrowed at its point of use under this repo's strict settings; each was fixed by checking the raw field again right before use, not with a cast or a non-null assertion.
