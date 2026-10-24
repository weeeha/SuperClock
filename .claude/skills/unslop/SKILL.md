---
name: unslop
description: Anti-slop audit for AI-generated UI, bound to SuperClock. Use BEFORE designing or building any new face, kiosk view, or admin surface (constraints first), and AGAIN before calling it done (audit + fix). Also use when reviewing UI, when something "looks AI-generated", or when the user says slop, generic, or template-y.
---

# Unslop

Slop is the absence of decisions — an unguided model emits the statistical
median of its training data: indigo gradients, three-card grids,
glassmorphism, `#8884d8` charts, "Elevate Your Workflow". Four root causes:
**statistical gravity** (most-copied snippet wins), **decoration faking
hierarchy**, **fabrication pressure** (invented stats/testimonials/data), and
**per-emission amnesia** (values drift, components duplicate across
generations). Counter all four: decide once in the project's system, ban the
named defaults, require provenance, audit with counts — not vibes.

Portable origin: the `unslop` skill shared by Minimal-Design-System and
Super-AI-Components (research: 12 lenses, ~110 indicators, ~40 sources in
Minimal-Design-System's `docs/superpowers/specs/2026-08-11-anti-slop-rules.md`).
Phase 0 below rebinds it to this repo and holds every SuperClock amendment;
Phases 1–3 are the portable core, generated from me:unslop.

## Phase 0 — SuperClock's bindings

This repo has already decided, and these are law:

- **Colour goes through three tiers.** `src/styles/tokens.css` holds tier 1
  ramps (read only by tier 2) and tier 2 roles, the only place a day value
  and a night value are ever written: `--brand`, `--brand-ink`, the
  `--status-*` family, `--surface-*`, `--ink`, `--ink-muted`, `--line`,
  `--focus`, `--fill*`, `--sheet-ink`, and the eight `--face-*` names, which
  are roles themselves. A component reads a utility or a role, never a
  ramp. Tier 3 (the admin's shadcn vocabulary aliasing onto roles) is not
  built: admin tokens still live apart in `src/admin/index.css` under
  `.admin-root`, and the kiosk's `src/index.css` keeps a small `@theme`
  block only for tokens that must become utilities. A surface that does
  not change between modes needs foreground roles that do not change
  either (`--sheet-ink`, `--fill-knob`), never `--ink`. Gated by
  `src/shared/token-tiers.test.ts`, `token-contrast.test.ts` (every
  ink/surface pair at 4.5:1, both modes) and `token-liveness.test.ts`;
  `npm run check:tokens` is the write-time half and joins Phase 2.
- **Faces respond to night mode through tokens.** Night is a `--face-*`
  palette flip, not per-face logic; a face must read the tokens and survive
  both palettes (`FACE_TOKEN_EXEMPT` in `scripts/lib/token-rules.mjs` holds
  the seven legacy faces and may only shrink). The **one-accent-quantity
  rule** from the three-faces study holds: one saturated accent quantity
  per face (`FCE-1`).
- **Apps paint the palette, not a hardcoded surface** (`SUR-1`, decided
  2026-10-23). An app paints `bg-(--face-bg)` and reads `--face-ink`,
  `--face-ink-muted` and `--face-tick` for inks, `--face-plate` for
  platters, `--face-ghost` for hairlines and tracks, and keeps its one
  accent. Fields-skin apps use their own `--fields-<app>*` roles. An app
  whose black is content (fire, a glow, a vendored stage) is a sanctioned
  exemption with its reason in the rule record, never a silent one.
- **The kiosk viewport is a 1080×1080 circle.** The kiosk responsive pass is
  "nothing load-bearing outside the disc" (corners are invisible on round
  devices), not 375px. The admin is phone-first: 375px applies there.
- **Ambient motion is content, not chrome.** Breathing, Fireplace, and clock
  hands are sanctioned idle animation because the animation IS the app.
  Chrome, overlays, and every admin surface animate only on state change.
  Active-aware effects: any `setInterval`/rAF gates on `props.isActive`.
- **Honest offline.** An app that fetches shows an explicit offline/stale
  tell (WeatherApp and GithubApp are the reference); rendering fallback or
  mock data as live is fabrication.
- **Pure `#000`/`#fff` is reserved for the night palette tokens** — never
  introduced ad hoc elsewhere.
- **lucide-react** is the only icon library; **Inter** is the only UI family
  (faces may carry their own display type as a designed decision, e.g.
  Strokes' junction-gap digits).
- Unimplemented schema options render **disabled with their schema-meta
  note** — never hidden, never silently broken.
- **Compose from what exists:** RoundList, StateRing, SchemaForm, and the
  shadcn primitives under `src/admin/components/ui/`.

**Exceptions to the core** (these override Phases 1–3):

- Effects: pure `#000`/`#fff` only through the night palette tokens, above.
- Motion: the ambient carve-out above. Scroll-reveal, marquee, typewriter and
  parallax stay banned everywhere; kiosk timers gate on `isActive`.
- Copy: fabrication includes fake device names, fake fleet health, and mock
  weather rendered as live.
- States: offline/stale is a fifth designed state, with its honest tell. AA
  contrast holds in BOTH the day and night palettes. Visible keyboard focus
  is an admin requirement.
- Responsive: the admin gets the 375px pass (no horizontal scroll, ≥24px tap
  targets, 44px in sticky bars, no hover-only actions, `dvh` not `vh`). The
  kiosk gets the circle-crop pass instead: nothing load-bearing outside the
  disc, arc gesture zones unobstructed.
- Counts: one saturated accent per face; that is the rule, not per viewport.
- Hostile fixtures add: offline, stale cache, empty playlist, 90-char device
  name.

**Mechanical audit.** `npm run check:tokens` (token contract), `npm run
check:rules` (the 26 records in `rules/superclock.json`: `grep`,
`heuristic` and `requires` rules run mechanically, `delegated` rules name
the gate that owns them (the token gate, ESLint, the LVGL parity test),
`judgment` and `rendered` rules print as unchecked, never as passed; every
mechanical rule proves itself on a bad/good fixture pair under
`scripts/lib/__fixtures__/rules/`) and `npm test` (registry coherence,
contract, schema liveness, the rule ratchet, the token tiers) all green.
Raw `#hex|rgba?(|hsl(` outside the token files stays the token gate's job
(`SYS-1`, delegated). Tiers map onto the records' `severity`: `blocker` is
Floor, `review` and `warning` are Reflex. `rulecheck.mjs` does not yet
read `unslop-waive` comments, so a waiver is read by the audit, not by
the script, until that lands.

**Render tier.** The six unchecked rules are what
`node ~/.claude/me-skills/skills/unslop/scripts/render.mjs` measures:
`STA-7` and the admin's tap targets at `--widths 375` against the admin
routes on the dev server (`/`, `/clock/<id>`, `/clock/<id>/apps`), `STA-5`
as contrast read from the pixels behind the text, run once per palette
(night follows the night window and the local override, not the OS
scheme, so flip night in the app and rerun rather than `--scheme`), and
`KIO-2` with
`--widths 1080 --shots <dir>` on the kiosk, the circle crop then judged on
the screenshot. `--allow-move` has no selectors yet: a box that moves
under hover or focus is a finding until Phase 0 names the disclosure
component that is allowed to. `--allow-motion` is the ambient
carve-out, and until the Breathing, Fireplace and clock-face roots carry
a `data-ambient` attribute to name, run the motion-at-rest pass on the
admin and on non-ambient apps only and read the ambient ones by eye. The
kiosk does not get the 375 pass; the admin does not get the circle crop.

**Extra fix rows** (these win over the core's rows of the same name):

| Violation | Substitute |
|---|---|
| Emoji/icon leak | lucide at its sizes, or nothing |
| Loops/scroll FX outside ambient apps | Bind to real state change or render static |
| Contrast fail | Move UP the ink/tone ramp or lighten surface; never a one-off darker hex |
| Mock data shown as live | Honest offline/stale tell (WeatherApp pattern); never a silent fallback |
| Timer ticking while inactive | Gate the effect on `props.isActive` |
| Face broken at night | Consume `--face-*`; never fork a night variant of the component |
| App surface hardcoded (white by day, black by night) | `bg-(--face-bg)` plus the `--face-*` inks (`SUR-1`); a black that is content gets its reason in the rule record |
| Mode-stable surface reading `--ink` | Read `--sheet-ink` / `--fill-knob`, the roles that do not invert |

<!-- unslop-core:start me@1.26.0 sha256:5686cdc56590fe43 -->
<!-- Generated from me:unslop by its scripts/sync.mjs. Edit that skill, not this block; this repo's own rules go in Phase 0 above. -->
<!-- prettier-ignore-start -->
## Phase 1: Constraints while generating

Every rule carries a **tier**, which says whether you may disagree with it:

- **Floor** (a repo detector's `blocker`): never waivable. Correctness,
  access, honesty, and the named defaults no admired product breaks on
  purpose. A hit is fixed.
- **Reflex** (`review` / `warning`): a default a model falls into. Waivable
  on the record, in a comment at the hit:
  `unslop-waive <RULE> · <guard evidence> · <reason>`. The evidence is what
  makes this hit not a hit here (the modal scrim sits over the real page);
  the reason is about this screen and shares a word with it. A reason that
  is boilerplate, or reused word for word on another waiver, is not a
  waiver. The same rule waived three times is a house style: write it into
  Phase 0 and drop the waivers.
- **Finish**: craft detail invisible at arm's length. Reported and
  answered, never blocking.

The bans below are Floor unless marked (R). A repo's Phase 0 may move a
rule between tiers with a reason; it may not delete one.

1. **Effects.** No gradient text (`bg-clip-text`), no gradients on controls
   or text, no indigo→violet gradient anywhere, no glassmorphism without real
   underlying content, no blurred orbs / spotlights / grain layers, no colored
   or glowing shadows, no pure #000/#fff pairs.
2. **Type.** Only the project's declared families and scale; no new fonts,
   ad-hoc sizes, or blanket `tracking-tight` (R); no italic-serif accent
   words (R); hierarchy = size/weight, never decoration. **No eyebrow**:
   short inert type before a heading, in any geometry (stacked label, pill,
   ordinal, category tag over a card, TRUSTED BY over logos); delete it and
   read the section, and if nothing was lost but a name for what comes next
   it was an eyebrow. A `<figcaption>`, `<th>`, `<label>`, byline, `<time>`
   or a unit after its figure is not one. **No tracked-caps label**: text at
   15px or under set uppercase, small-caps, or letter-spaced past 0.03em; a
   wordmark excepted.
3. **Layout.** Container nesting ≤1 (no cards in cards); separation ladder:
   spacing → hairline → surface tint → card; radii and gaps only from the
   project's scale; no exactly-3-equal-cards reflex (R); no identical
   stat-card strips (R); no bento mosaic where every cell is the same size
   (R); the screen's most important element visibly dominant. **No default
   dashboard shell** (R): sidebar + top bar + four stat cards + chart +
   table, chosen before anyone named the screen's job and the one decision
   the user makes on it; if the job is "spot the failing job and retry it",
   the failing jobs are the page and the stat row is a footnote. **Layout
   does not move on state change**: hover, focus and selection may change
   colour/shadow/ring/opacity, never padding, gap, size, border-width or
   type; space for anything conditional is reserved at rest (disclosure
   components are the declared exception).
4. **Components.** Compose from the project's library (search before
   creating; no V2 duplicates); no colored left-border accent strips; no
   icon in a tinted rounded tile above a heading; no "✨ AI-powered" badge
   theater; unlabeled sparkle icons never. **Every control does
   something**: a form that prints "Sent" with no request behind it is an
   invented outcome (validate, post nowhere, say "Nothing was sent; this
   form is not connected yet"); a nav link to nowhere and a button with no
   handler ship labelled "Coming soon" or not at all.
5. **Icons.** One library, one weight, 2–3 sizes; zero emoji in chrome.
6. **Motion.** Only on state change; no idle loops, scroll-reveal, marquee,
   typewriter, parallax; never `transition: all`; transform/opacity only;
   `prefers-reduced-motion` guard whenever keyframes exist. **Nothing
   hidden at rest**: a reveal class that sets `opacity: 0` or
   `visibility: hidden` until a script runs ships blank when the script
   fails; hide only under a `.js` class, or animate from visible with
   `@starting-style`.
7. **Copy.** Verb + object labels (never "Get Started"/"Learn More"); banned
   register: elevate/unlock/empower/seamless/effortless/supercharge,
   "not just X, it's Y", exclamation marks in microcopy; zero fabricated
   numbers, names, quotes, logos, or demo data no real system could emit.
   **No template punctuation**: meta strings joined with middle dots
   (`A · B · C`), an arrow glued to link or button text (`Learn more →`),
   a decorative status dot before a label; one dot in a byline, or a dot
   that marks a live state, is legal. **No filler people**: John Doe,
   johndoe@example.com, "Sarah Chen updated a document, 2 hours ago"; an
   empty cell stays empty or carries an honest placeholder (`Your name`,
   `email@example.com`).
8. **Charts.** Project palette only (never `#8884d8`/`#82ca9d`); linear/step
   interpolation; no gradient area fills; flat marks; units visible; bars
   zero-based; <4 data points is a stat, not a chart. **The title is the
   question the chart answers** ("Failed jobs per hour, last 24h"), never
   "Overview" or "Performance"; a delta ("+12% this week") only with a
   real, named comparison period behind it.
9. **States & a11y.** Empty/loading/error/populated all designed; anything
   that fetches also gets an honest offline/stale tell, never fallback or
   mock data rendered as live; visible focus on everything interactive; AA
   contrast on the actual surface, in every theme the project ships;
   semantic elements (no onClick divs); accessible names on icon buttons.
   **Chrome states count too**: every collapsed/compact/truncating mode a
   component declares is designed and checked, and truncation is decided for
   the tree, not per leaf.
10. **Responsive.** Verify at 375px: no horizontal scroll, ≥24px tap targets
    (44px in sticky bars), no hover-only actions, tables get a small-screen
    strategy, `dvh` not `vh` for shells.

## Phase 2: Audit before "done"

Audit what you changed. Older code that already breaks a rule is its own
scoped task; do not sweep it uninvited.

**Mechanical first.** If the project has a rule detector or token gate
(Phase 0 names it), run it and apply each hit's own `fix` rather than
inventing one. Do not re-grep what a gate already owns: greps run from
memory go stale, and two of this skill's own greps once sat broken for weeks
that way. Then work the detector's `unchecked` list, the rules no script can
run. They are reported so they cannot be forgotten, and most of them
discharge in the rendered passes below.

**Without a detector**, grep the changed files (expect zero, exceptions
justified), over the same roots the project's gate scans if it has one; a
grep list that disagrees with the gate's scope is where a violation
survives: `bg-gradient-|bg-clip-text|backdrop-blur` · raw
`#hex|rgba?(|hsl(` in components when a token system exists · arbitrary
`[Npx]` values · `transition-all|animate-` outside sanctioned loaders ·
`8884d8|82ca9d|strokeDasharray="3 3"` · emoji codepoints in chrome ·
`elevate|unlock|empower|supercharge|seamless|effortless` in copy.

**Render tier.** `node <skill-dir>/scripts/render.mjs <url|file ...>`
opens the changed screens in headless Chrome over the DevTools protocol
(nothing to install beyond Chrome; `CHROME_PATH` overrides the binary) at
375 and 1280 and measures what the passes below used to eyeball:
horizontal overflow and elements spilling past the 375 screen · controls
whose computed style does not change under a forced `:focus-visible` ·
**state stability** (every visible element's box at rest, then under a
forced `:hover` and `:focus` on each control; a box that moved or grew is
the finding, the control that triggered it is named) · **motion at rest**
(`document.getAnimations()` on the idle page, minus the loaders Phase 0
sanctions) · text contrast read from the pixels behind the glyphs, so a
surface painted by a pseudo-element, an absolute layer or an image counts
as the eye sees it · tap targets under 24px at 375. `--shots <dir>` writes the screenshots the
chrome-states and squint passes read; `--allow-move` and `--allow-motion`
take the selectors Phase 0 names (disclosure components, skeletons);
`--scheme dark` reruns under the other theme. Exit 1 on any FAIL.
`--selftest` runs it against its own slop and clean fixtures: a check that
has not caught its planted positive proves nothing, and a clean run is
read only after the selftest passed.

Rendered passes, after the render tier: **squint** (one thing dominant, no
identical section anatomy) · **counts** (font sizes ≤7, radii/shadows ⊆
project scale, ≤1 saturated accent per viewport; browser surfaces themed,
since selection colour, caret, scrollbar and tabular numerals left at
browser defaults are the cheapest tell a page was assembled) ·
**contrast** in every theme the project ships (the script runs one scheme
at a time) · **chrome states** (render every collapsed/compact/truncating
mode; a clipped focus ring still passes the DOM, so this pass is a
screenshot or it did not happen) · **hostile fixtures** (plausible, never
random: 3× strings, a one-letter name, a count of exactly 1, a missing
optional field, diacritics, empty, error, offline, mixed-sign data, 200%
zoom) · **ratchet** (distinct radii/shadows/sizes did not grow vs. before
the change).

## Phase 3: Fix ladder

Never fix by bare deletion: slop is a **faked decision**. Find the job the
decoration was doing and do it with the system's device. A repo's Phase 0
may add rows, and where one names the same violation as a row here, the
repo's row wins.

| Violation | Substitute |
|---|---|
| Gradient fill/text | Flat token; emphasis via size/weight/position; one accent word max |
| Glass/glow/orbs | Delete layer; separate via spacing → hairline → tint → card |
| Colored/new shadow | Project elevation token; focus → focus ring; attention → hierarchy |
| Raw hex/px | The project's token (match by usage); none fits → propose it, don't inline |
| Off-scale value | Snap to the project's nearest scale step |
| New font/size/weight | Nearest declared style; emphasis = weight step, not new size |
| Emoji/icon leak | Project icon set at its sizes, or nothing |
| Loops/scroll FX | Bind to real state change or render static; named transitions, ease-out |
| Copy register | Verb + object; unprovable adjective/number → delete the claim |
| Chart defaults | Project palette, plain line, linear/step, add unit, direct labels |
| Contrast fail | Move UP the text ramp or lighten surface; never a one-off darker hex |
| Nested cards | Dissolve inner boundaries down the ladder, keep content |
| 3-card reflex/stat strip | Rank content; dominant cell for the answering item, rest → row/table |
| Happy-path only | Empty = sentence + creating action; loading = matched skeleton; error = cause + retry |
| Mock data shown as live | Honest offline/stale tell; never a silent fallback |
| Layout moves on a state | Reserve the space at rest (`invisible`/`opacity-0`, or the same border in `transparent`); put the signal on colour/shadow/ring/opacity |
| Collapsed state loses content | Design the collapsed mode as its own state; icons keep their labels as tooltips/accessible names |
| Indicator clipped by an ancestor | Draw it on the ancestor that owns the boundary, or lift the clip one level |
| 375px fails | Mobile-first bases, `dvh`, padded hit areas, kebab menus, table strategy |
| Duplicate component | Delete new one; extend existing via its variant props |
| Ratchet growth | Converge onto existing steps; new steps enter via the token system only |
| Eyebrow / tracked-caps label | Delete it and read the section; a lost fact becomes the heading, a caption or a `<th>`; labels in the body face a step smaller, sentence case, untracked |
| Fake send / dead control | Validate, post nowhere, say so on screen; a link with no destination is removed or labelled "Coming soon" |
| Default dashboard shell | Name the screen's job and its one decision; the deciding list or table is the page, the stat row a footnote or gone |
| Template punctuation | Line breaks, columns, hairlines; a verb as the link label; a dot only where a state is live |
| Hidden at rest | Visible by default; hide under a `.js` class only, or animate from visible with `@starting-style` |
| Filler people / data | Empty cell, or an honest placeholder that names what goes there; a feed shows real events or does not ship |

Report as: violation → tier → rule area → fix applied, or the waiver with
its evidence. Each PASS names what was checked ("STA-7 PASS: render tier,
375 and 1280, 0 overflow"); a fabricated pass is itself slop. Re-run Phase
2 until clean.
<!-- prettier-ignore-end -->
<!-- unslop-core:end -->
