# Token layer: design

**Date:** 2026-09-06
**Status:** Design approved (Nick, this session). Sub-project 1 of four.
**Source:** design-system step 2 of the 2026-09-05 brainstorm. Steps 1 (token liveness gate, rule catalog) and 3 (face and widget contracts) are merged. Nick's steer, verbatim: dark mode for everything, and eventually density because the devices have various screen sizes. Nick ruled out installing or copying the `pegbo-ui` package: SuperClock's own system, brought to the same architectural level.
**Handoff:** `docs/agent-log.md` carries the session record; the implementation plan follows this spec.

## TL;DR

Both stylesheets gain the same three tiers: raw ramps nothing reads, one semantic layer that is the only place a light and a dark value are written, and aliases (`--face-*`, the shadcn names) that point at the semantic layer instead of holding values. That inversion is what lets one mode axis reach every surface and what makes a rebrand two edits. Density is not declared, because an axis with one value is the dead-token smell step 1 spent effort killing; instead dimensions become semantic roles so density has something to own later. This sub-project builds the layer and proves it on one surface. Re-tokenising the chrome, the admin, and the apps are sub-projects 2 to 4.

## Problem

Nick wants dark mode everywhere and, later, a density axis for the differently sized screens. Neither is reachable from where the tokens are today.

- **The kiosk's mode axis exists but reaches eight tokens.** `apply-settings.ts` already toggles `html.dark` / `html.light` from the theme setting, falling back to the night window. Only the `--face-*` set flips on it. The chrome paints `#000` and `#fff` directly on `body`, and its twelve remaining colour spots are `bg-black`, `text-white/50`, `bg-white/25` and their siblings. A mode flip cannot reach a literal.
- **The admin has no light palette at all.** Twenty three names under `.admin-root`, dark values only, and no mode signal of any kind. It is viewed on a phone, where the viewer has a system preference the admin ignores.
- **The names hold the values, which is backwards.** shadcn's names are the source in `src/admin/index.css`, so nothing can be re-themed without editing every name, and a stock shadcn component cannot inherit anything.
- **Four admin tokens are declared and read by nothing** (`--accent`, `--accent-foreground`, `--input`, `--popover-foreground`), ledgered by step 1 as unreachable until the admin gains a theme layer. This is that layer.
- **Density has no home.** The kiosk scales with 91 viewport-unit values, which handles 1080 round against 800 round but not the 800 by 480 square, whose shape differs rather than its size.

## Users and the job

- **Primary:** an agent session adding or restyling any surface in either SPA. Job: reach for a role that already carries both modes, instead of inventing a literal and a dark variant beside it.
- **Secondary:** Nick, reading the admin on a phone at night, and reading a kiosk across a room at noon.
- **Later, not designed for here:** a second density value for the square device, and per-device palettes.

## Approach

One semantic layer in a file both entries import, with the kiosk and admin aliases sitting above it. The consumer rule stays: a kiosk file may not write an admin token and the reverse, enforced by the token gate's existing zones. What changes is that light and dark are decided once rather than twice.

### Alternatives considered

| Option | Tradeoff | Why not |
|---|---|---|
| Two systems sharing only raw ramps | Keeps "never mixed" literally true | Every light and dark pair gets decided twice and the two drift; a density axis would need two homes |
| Install `pegbo-ui` for the admin | 109 reviewed parts, theme and finish axes, no build cost | Nick ruled it out: no dependency on a private package, and no copying. SuperClock's own system at the same level |

## The three tiers

| Tier | Holds | Read by |
|---|---|---|
| 1. Ramps | raw scales, no semantics | nothing outside tier 2 |
| 2. Semantic | every role, with its light value and its dark value | tier 3 only |
| 3. Aliases | `--face-*` (kiosk), shadcn names (admin) | components |

Tier 3 never restates a value. Every alias is a `var()` at a tier 2 role, which is what a gate can check mechanically and what makes the inversion real rather than claimed.

## The roles

Sized from what the code actually paints, not from a generic palette.

| Group | Roles | Evidence in today's tree |
|---|---|---|
| Surfaces | `ground`, `card`, `sheet`, `popover` | admin `--card` 12 uses, kiosk `bg-sheet` |
| Ink | `ink`, `ink-muted`, `ink-on-accent` | admin `--muted-foreground` 8, kiosk `text-white/50` 3 |
| Accent | `accent`, `accent-ink` | see open question 1 |
| Status | `danger`, `success`, `warning` | admin `--destructive` 12, `--warning` 7 |
| Lines | `border`, `focus` | admin `--border` 27, `--ring` 20 |
| Fills | `fill-subtle`, `fill`, `fill-strong` | kiosk slider tracks at white/15, /25, /80 |

Sixteen roles. Each carries a light value and a dark value in tier 2, and nowhere else.

The eight `--face-*` names keep their spelling and **are** tier 2 roles, not tier 3 aliases. They already carry a light and a dark value and are already semantic, so aliasing them to new names would add a layer that buys nothing. Tier 3 therefore exists only in the admin, where the shadcn names are a vendor vocabulary that genuinely needs the indirection. No face component changes in this sub-project and the face contracts' `night.tokens` claims stay true.

## The mode axis

The kiosk already has it: `html.dark` / `html.light`, set by `apply-settings.ts` from the theme setting, falling back to the night window. Tier 2 hangs its dark values on the same class, so the existing setting drives the whole layer the day a surface adopts a role.

The admin has no mode signal. It gains one from `prefers-color-scheme`, with the same class names on its own root so tier 2 is written once. The admin's mode is the viewer's phone preference, which is a different driver from the kiosk's schedule, and deliberately so: the same values, two triggers.

## Density, deliberately not declared

A `data-density` attribute with one value would be an axis nothing selects on, which is the same defect as a token nothing reads. Instead this sub-project puts dimensions into tier 2 as roles rather than raw steps, so a second density value has something to override when the square device earns it. Naming the roles is the cheap and reversible half; declaring the axis is not, and waits.

## Scope

**In:** tier 1 and tier 2 in a shared file, every role carrying both modes, the kiosk consuming it with its face values pinned unchanged, the gates below (including bringing the new file under the existing liveness gate), and one kiosk surface re-tokenised end to end as proof.

**The admin's participation moved out on 2026-09-06, mid-build.** Tier 3, the admin's import, its mode signal and its light palette now all land in sub-project 2 together with the consumers that use them. The reason is evidence rather than taste: `@theme inline` emits a custom property for every alias while the generated utilities bypass it, so declaring 21 aliases before anything writes `bg-card` ships 21 dead variables to every Pi and forces 21 entries onto a list whose whole discipline is that it may only shrink. `scripts/lib/token-liveness.mjs` states the rule this breaks in its own header: wire it or do not declare it. The same reasoning already kept the density axis undeclared in this spec, and applying it to one and not the other would be incoherent.

**Proof surface:** the quick-settings sheet. It is the smallest kiosk surface that uses every group (a surface, two ink levels, all three fills, and the accent), it is already isolated behind an overlay, and it is where open question 3 will be answered.

**Out**, each its own sub-project in this order:
2. Chrome and admin re-tokenised. The three open questions below land here.
3. The nine data apps.
4. The four ambient apps and a review of the face light values under the new ramps.

Also out: a second density value, per-device palettes, motion tokens, spacing and elevation roles, and the Storybook contrast harness named in Known gaps.

## Gates

Extending what exists rather than adding a parallel set.

| Gate | Fails when | Where |
|---|---|---|
| Both modes | a tier 2 role carries a value in one mode and not the other | `src/shared/token-liveness.test.ts` |
| Alias, never value | a tier 3 name holds a literal instead of a `var()` at a tier 2 role | same |
| No tier skipping | a component reads a tier 1 ramp, or a tier 2 role directly | `scripts/check-tokens.mjs` zones |
| Liveness | unchanged from step 1: every declared token has a reader or a ledger entry | `src/shared/token-liveness.test.ts` |
| Contrast | an ink role against its surface role falls below 4.5:1, in either mode | new, `src/shared/token-contrast.test.ts` |

The contrast gate is why rule R11 stops being `unchecked`. It checks the declared pairs at the token level, which is not the same as checking a rendered screen, so R11's record must say which half it now covers and keep the rendered half honest.

`UNCONSUMED_LEDGER` does **not** shrink in this sub-project, and saying otherwise would be the exact dishonesty these gates exist to prevent. The liveness gate requires a reader, not reachability. The four admin tokens gain a route the day the theme layer lands, but nothing consumes that route until sub-project 2 re-tokenises the admin's surfaces. Their ledger reasons change from "unreachable" to "reachable, unconsumed until the admin surfaces adopt the utilities", and the entries stay.

## Key decisions

| # | Decision | Choice | Why |
|---|---|---|---|
| 1 | Where light and dark are decided | one semantic layer, imported by both entries | two copies drift, and density would need two homes |
| 2 | The consumer rule | unchanged: kiosk files may not write admin tokens or the reverse | the gate's zones already enforce it, and mixing at the consumer level is what the rule was protecting against |
| 3 | The face token names | kept exactly, promoted to tier 3 aliases | no face changes, and the contracts' `night.tokens` claims stay true |
| 4 | Density | not declared; dimensions become roles | an axis with one value is a dead token wearing a hat |
| 5 | The admin's mode driver | `prefers-color-scheme`, not the kiosk's schedule | the admin is a phone in a hand, the kiosk is a clock on a wall |
| 6 | Proof surface | the quick-settings sheet | smallest surface touching every role group |

## Success criteria

- `./scripts/gates.sh` green, with the new both-modes, alias and contrast gates in `npm test`.
- Every one of the sixteen roles carries a light and a dark value, and no tier 3 alias holds a literal.
- The quick-settings sheet renders from roles only, verified in both modes.
- `UNCONSUMED_LEDGER` is the same length, with the four admin entries' reasons updated to say they are now reachable and awaiting a consumer.
- R11 in the rule catalog names its token-level detector and states plainly that the rendered half is still unchecked.
- No pixel changes outside the proof surface. The face tokens resolve to the same values they hold today.

## Open questions

All three change pixels, all three are Nick's, and none blocks this sub-project. They land in sub-project 2, where the chrome and admin are actually re-tokenised. Until then the layer preserves today's values exactly.

1. **Three oranges, not two.** `--color-accent: #ff8826` in the kiosk stylesheet, `DEFAULT_ACCENT = '#ff6b35'` in `src/shared/types.ts`, and the admin's `--primary: 20 96% 60%`, which resolves to `#fb7837`. AGENTS.md has recorded two of them as an open decision since 2026-08-14; the third was found while deriving values for this spec on 2026-09-06. One `accent` role means one wins, unless they stay separate named roles for separate jobs.
2. **The admin border reset.** The unlayered `.admin-root *` border-color reset outranks every layered Tailwind utility, so 75 radius and every border utility are currently inert. Layering it under `@layer base` revives them and changes borders across 24 admin files at once. Also an AGENTS.md open decision.
3. **Kiosk chrome in light mode.** The quick-settings sheet is deliberately dark in both palettes today, and the rest of the chrome is hardcoded dark. Under the mode axis the rest would go light. Nick has seen the glass at noon and I have not.

## The admin's value format, a transitional constraint

The admin's roughly one hundred consumers read tokens as bare HSL triplets inside arbitrary values (`text-[hsl(var(--border))]`). A tier 2 that stores complete colours cannot feed them, and migrating every consumer is sub-project 2's work, not this one's.

So this sub-project leaves the existing triplet declarations in place, untouched and still working, and adds the `@theme inline` aliases beside them. During the transition an admin colour is reachable two ways, and the triplet form is the one that is leaving. Sub-project 2 deletes it when the consumers move to utilities. The liveness gate must not read the surviving triplets as dead, and the plan says how.

## Risks

- **The face values must not move.** Thirteen faces and their contracts depend on the eight `--face-*` names resolving as they do now. The promotion to aliases is the riskiest edit here, and the token-level assertion that each alias resolves to its current value is what makes it safe.
- **A contrast gate can be quietly narrowed.** Checking one pair and reporting green is the failure mode the last sub-project kept finding. The gate must derive its pairs from the role list rather than a hand-kept array, so a role added later arrives already checked.
- **The admin has never rendered light.** Its light values are invented in sub-project 2, not here, and they will need Nick's eye.

## Changelog

- 2026-09-06: initial draft from the approved design.
- 2026-09-06, mid-build: the admin's whole participation moved to sub-project 2, and a new task brings the token file under the liveness gate. See the Scope section. Four earlier corrections found while deriving exact values for the plan. The ledger does not shrink here, because liveness requires a reader and nothing consumes the new admin route until sub-project 2. The eight face tokens are tier 2 roles rather than tier 3 aliases, which removes a layer. A third accent orange exists in the admin (`#fb7837`), so open question 1 covers three values. The admin's bare-triplet consumer format is recorded as a transitional constraint with its own section.
- 2026-09-07: implemented over commits `6644fb1` through `07c23d2`. Diverged from this document in three places. The Roles table above still lists `accent`, `accent-ink`, `danger`, `success`, `warning`; the names actually built are `--brand`, `--brand-ink`, `--status-danger`, `--status-ok`, `--status-warn`, `--status-warn-ink`, renamed in the plan's preflight ruling before Task 1 was dispatched because the original names collide with the admin's own existing tokens and `.admin-root` wins by specificity; that ruling never made it back into this table, and this line is the correction. The proof surface needed two roles this document never named: `--sheet-ink` and `--fill-knob`, both mode-invariant, because `--ink`/`--ink-muted` invert between modes and read wrong against `--color-sheet`'s deliberately fixed dark value. `UNCONSUMED_LEDGER` ended at 21 entries, a number this document commits to nowhere else: 12 are the admin's Group 2 roles declared ahead of their sub-project-2 consumers, 2 are `--ink`/`--ink-muted` for the reason above, the rest are the original 7 unchanged. R11 has its detector now, `src/shared/token-contrast.test.ts`, and its statement is narrowed to token-level pairs, per the Gates section. One unplanned task (5b) closed a standing weakness in the liveness gate itself: a token name inside a comment used to count as a reader; the gate now strips comments first, sharing a module with `scripts/rulecheck.mjs`. `./scripts/gates.sh` green throughout, run in full for the first time on this work: lint clean, check:tokens (21 ledgered, 5 rules with no detector), 987 tests across 68 files, production build.
