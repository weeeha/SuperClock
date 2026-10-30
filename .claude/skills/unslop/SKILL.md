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
Phases 1–3 are the portable core, generated from unslop:unslop.

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
- **Neon glow is content on the neon faces** (decided 2026-10-30, when Nick
  asked for intense neon faces). The `neon-*` faces (src/apps/clock/neon/)
  draw additive glow and white-hot cores because a neon tube is light: the
  core's "no glowing shadows" and "no blurred orbs" Floor rules do not apply
  inside their canvas, the same way the ambient-motion line below lets clock
  hands move. The carve-out stops at the canvas: chrome, overlays, the admin
  and every other face keep the Floor rules, and a neon face still holds one
  saturated accent quantity (FCE-1, named in its meta).
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
`node "$HOME/ClaudeCode Projects/Unslop/skills/unslop/scripts/render.mjs"` (the unslop plugin's checkout) measures:
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

<!-- unslop-core:start unslop@2.0.0 sha256:011c356a950bad0e -->
<!-- Generated from unslop:unslop (weeeha/unslop) by its scripts/sync.mjs. Edit that skill, not this block; this repo's own rules go in Phase 0 above. -->
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
   or glowing shadows, no pure #000/#fff pairs. A shadow has an offset and a
   blur; a hard block shadow (`4px 4px 0`) belongs only to a world that chose
   neobrutalism (R). No blob or `clip-path` shape standing in for a real
   cut-out of the subject (R). No cream-paper default (cream page, thin
   serif, italic accent, pill buttons) picked because nothing else was
   decided (R). Secondary text on a coloured surface is tinted from that
   surface, never a neutral grey.
2. **Type.** Only the project's declared families and scale; no new fonts,
   ad-hoc sizes, or blanket `tracking-tight` (R); no italic-serif accent
   words (R); hierarchy = size/weight, never decoration. **No eyebrow**:
   short inert type before a heading, in any geometry (stacked label, pill,
   ordinal, category tag over a card, TRUSTED BY over logos); delete it and
   read the section, and if nothing was lost but a name for what comes next
   it was an eyebrow. A `<figcaption>`, `<th>`, `<label>`, byline, `<time>`
   or a unit after its figure is not one. **No tracked-caps label**: text at
   15px or under set uppercase, small-caps, or letter-spaced past 0.03em; a
   wordmark excepted. **Readable text**: no text under 12px; headings in
   outline order (no h1 to h3) and each level a visible size or weight step
   from the next, never a flat scale; body measure 75ch at most (R), body
   leading 1.4 or more (R), no justified or all-caps running text (R),
   display type 6rem at most and tracking no tighter than -0.04em (R).
   Monospace only for code, data and measurement, never as a "technical"
   costume (R).
3. **Layout.** Container nesting ≤1 (no cards in cards); separation ladder:
   spacing → hairline → surface tint → card; radii and gaps only from the
   project's scale; no exactly-3-equal-cards reflex (R); no identical
   stat-card strips (R); no bento mosaic where every cell is the same size
   (R); no hero-metric block (big number, small label, supporting stats)
   standing in for a headline (R); no section numbers (01 / 02 / 03) unless
   the order is information (R); no modal for a task that neither interrupts
   nor needs locked focus (R); the screen's most important element visibly
   dominant. **Breathing room**: more space above a heading than below it;
   text and cards never touch the screen edge (a 16px gutter at 375 at
   least); padding inside a bordered or filled box from the spacing scale,
   never cramped against its text (R). **No default
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
   handler ship labelled "Coming soon" or not at all. **One filled control
   per view**: the primary action is filled, every other control is
   outlined or plain, so the way forward is the one solid shape (R).
5. **Icons.** One library, one weight, 2–3 sizes; zero emoji in chrome.
6. **Motion.** Only on state change; no idle loops, scroll-reveal, marquee,
   typewriter, parallax; never `transition: all`; transform/opacity only;
   `prefers-reduced-motion` guard whenever keyframes exist. **Nothing
   hidden at rest**: a reveal class that sets `opacity: 0` or
   `visibility: hidden` until a script runs ships blank when the script
   fails; hide only under a `.js` class, or animate from visible with
   `@starting-style`. A `setInterval` or animation-frame loop runs only
   while its view is visible: gate it on `document.hidden` or the view's
   own active flag (R).
7. **Copy.** Verb + object labels (never "Get Started"/"Learn More"); banned
   register: elevate/unlock/empower/seamless/effortless/supercharge,
   "not just X, it's Y", exclamation marks in microcopy, aphoristic cadence
   (a run of two- or three-word fragments, "Fast. Simple. Yours.", standing
   in for a sentence) (R), cheerleading ("You've got this", "Great job!")
   and celebration overlays (confetti, trophies) for a routine action,
   where the interface should report the result (R); zero fabricated
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
   real, named comparison period behind it. **One channel, one
   variable**: colour, length, position and size each encode one thing; a
   ring whose colour is the status and whose length is the progress makes
   the reader decode two scales at once (R).
9. **States & a11y.** Empty/loading/error/populated all designed; anything
   that fetches also gets an honest offline/stale tell, never fallback or
   mock data rendered as live; visible focus on everything interactive; AA
   contrast on the actual surface, in every theme the project ships; a
   surface that keeps its colour in both themes takes text roles that keep
   theirs too, or its text inverts against it. **Never colour alone**: a
   state or reading carried by colour (overdue, failed, done, over budget)
   also carries a word, an icon, a shape or a position. **Themes flip
   tokens, not components**: dark mode is the same component reading
   flipped roles, never a forked dark variant (R). Semantic elements (no
   onClick divs); accessible names on icon buttons; the page loads with no
   broken image and no uncaught script error.
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
survives. Each effect pattern carries the Tailwind class and the plain-CSS
spelling, because a repo without Tailwind writes only the second:
`bg-gradient-|linear-gradient\(|radial-gradient\(|bg-clip-text|background-clip:[[:space:]]*text|backdrop-blur|backdrop-filter`
· raw `#hex|rgba?(|hsl(` in components when a token system exists ·
arbitrary `[Npx]` values ·
`transition-all|transition:[[:space:]]*all|animate-` outside sanctioned
loaders · `8884d8|82ca9d|strokeDasharray="3 3"` · emoji codepoints in
chrome · `elevate|unlock|empower|supercharge|seamless|effortless` in copy.
Before trusting a zero, run the same list over
`<skill-dir>/fixtures/grep/classic-slop.html`: every pattern hits it, so a
pattern that comes back empty there is broken, not clean.

**Second detector, any repo.** Impeccable's CLI (`pbakaus/impeccable`) runs
62 fixed rules with no model and no key, and catches tells a grep cannot
see: Inter as the primary font, a purple palette, an icon tile or kicker
above a heading, nested cards, a zero-offset glow, a flat type scale, a
skipped heading level. Run both modes; each sees rules the other misses (on
the fixture, the file scan caught the font, glow and nested cards and the
URL scan caught the kicker):

    DO_NOT_TRACK=1 npx --yes impeccable@4.8.0 detect --json <changed files>
    DO_NOT_TRACK=1 npx --yes impeccable@4.8.0 detect --json <dev-server url>

Exit 2 is findings, 1 is a target it could not scan. Read each hit as the
unslop rule it matches; the tier comes from this skill, not from
Impeccable. It has no rules for render behaviour (layout moving on a state,
motion at rest, tap targets, overflow) or honesty (invented numbers, filler
people, dead controls), so a clean Impeccable run discharges nothing in
this skill. Run only `detect`: `impeccable install` adds edit hooks, a
downloaded engine and `.impeccable/` files to the repo. Move the pin to a
newer version only after that version still flags the fixture.

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
as the eye sees it · tap targets under 24px at 375 · **readable text**:
text under 12px, running text over 80ch a line or justified, leading under
1.35, text within 16px of the screen edge at 375, a skipped heading level
or a heading no bigger or heavier than body text · an image that loaded
nothing · an uncaught script error on load. `--shots <dir>` writes the
screenshots the chrome-states and squint passes read; `--allow-move` and
`--allow-motion` take the selectors Phase 0 names (disclosure components,
skeletons); `--scheme dark` reruns under the other theme. Reflex checks
(measure, leading, edge) report WARN and Floor checks FAIL; exit 1 on any
FAIL.
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
random: the worst real day (everything overdue, nothing done),
which is the screen to design for rather than the demo's good day, 3×
strings, a one-letter name, a count of exactly 1, a missing
optional field, diacritics, empty, error, offline, mixed-sign data, 200%
zoom, labels 40% longer as a translation makes them, one unbroken
40-character token such as a URL or email, a right-to-left run, a number
and date in another locale's format) · **ratchet** (distinct radii/shadows/sizes did not grow vs. before
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
| Long measure / tight leading / tiny text | `max-width` in `ch` on the text block; leading and sizes from the type scale's own steps |
| Skipped heading / flat scale | Re-level headings to the page outline; each level one scale step or one weight step from the next |
| Text or card on the screen edge / cramped box | Gutter and padding from the spacing scale; more space above a heading than below |
| Hard block shadow / blob mask | The project's elevation token; a real cut-out asset of the subject, or a plain rectangle |
| Cream-paper default | Name the product's world in Phase 0 and take the palette and type from it; without one, the system's neutral tokens |
| Hero metric / section numbers | The real headline leads; a number earns size only as the answer to the screen's question; ordinals only where order is information |
| Aphoristic cadence | One plain sentence with a verb that says what the thing does |
| Broken image / script error | Fix the path or the error; an image that may be missing gets a sized placeholder and alt text |
| Colour-only state | Add the word, icon, shape or position; the colour stays as reinforcement |
| Two variables on one channel | Give the second variable its own channel: position, length or a label |
| Cheerleading / celebration | State the result plainly with the next small action; a celebration becomes the result plus Undo |
| Second filled control | Demote it to outlined or plain; one filled control per view |
| Loop running while hidden | Gate the interval or frame loop on visibility or the view's active flag |
| Forked dark variant / fixed surface with flipping text | One component reading roles; a surface that keeps its colour reads roles that do not invert |

Report as: violation → tier → rule area → fix applied, or the waiver with
its evidence. Each PASS names what was checked ("STA-7 PASS: render tier,
375 and 1280, 0 overflow"); a fabricated pass is itself slop. Re-run Phase
2 until clean.
<!-- prettier-ignore-end -->
<!-- unslop-core:end -->
