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
Phase 0 below rebinds it to this repo; Phases 1–3 are the portable core with
SuperClock amendments marked.

## Phase 0 — SuperClock's bindings

This repo has already decided, and these are law:

- **Two token systems, never mixed.** Kiosk surfaces consume the `@theme`
  tokens in `src/index.css` (`--color-accent`, the `--face-*` set); admin
  surfaces consume the shadcn semantic tokens scoped to `.admin-root` in
  `src/admin/index.css`. `npm run check:tokens` is the mechanical audit and
  joins Phase 2.
- **Faces respond to night mode through tokens.** Night is a `--face-*`
  palette flip, not per-face logic; a face must read the tokens and survive
  both palettes (legacy exceptions live in the token gate's exemption list,
  which may only shrink). The **one-accent-quantity rule** from the
  three-faces study holds: one saturated accent quantity per face.
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

## Phase 1 — Constraints while generating

Universal hard bans (researched AI tells — any occurrence needs an explicit
justification):

1. **Effects** — no gradient text (`bg-clip-text`), no gradients on controls
   or text, no indigo→violet gradient anywhere, no glassmorphism without real
   underlying content, no blurred orbs / spotlights / grain layers, no colored
   or glowing shadows, no new pure #000/#fff pairs (see Phase 0 night
   exception).
2. **Type** — only the project's declared families and scale; no new fonts,
   ad-hoc sizes, or blanket `tracking-tight`; no italic-serif accent words;
   no caps eyebrow repeated per section; hierarchy = size/weight, never
   decoration.
3. **Layout** — container nesting ≤1 (no cards in cards); separation ladder:
   spacing → hairline → surface tint → card; radii and gaps only from the
   project's scale; no exactly-3-equal-cards reflex; no identical stat-card
   strips; the screen's most important element visibly dominant.
4. **Components** — compose from what exists (RoundList, StateRing,
   SchemaForm, the shadcn primitives under `src/admin/components/ui/`);
   search before creating; no V2 duplicates; no colored left-border accent
   strips; no "✨ AI-powered" badge theater; unlabeled sparkle icons never.
5. **Icons** — lucide only, one weight, 2–3 sizes; zero emoji in chrome.
6. **Motion** — only on state change *except the Phase 0 ambient carve-out*;
   no scroll-reveal, marquee, typewriter, parallax; never `transition: all`;
   transform/opacity only; anything with keyframes respects
   `prefers-reduced-motion`; kiosk timers gate on `isActive`.
7. **Copy** — verb + object labels (never "Get Started"/"Learn More"); banned
   register: elevate/unlock/empower/seamless/effortless/supercharge,
   "not just X — it's Y", exclamation marks in microcopy; zero fabricated
   numbers, quotes, or demo data no real system could emit — including fake
   device names, fake fleet health, and mock weather rendered as live.
8. **Charts** — project palette only (never `#8884d8`/`#82ca9d`);
   linear/step interpolation; no gradient area fills; flat marks; units
   visible; bars zero-based; <4 data points is a stat, not a chart.
9. **States & a11y** — empty/loading/error/populated all designed — plus
   SuperClock's fifth state, **offline/stale**, with its honest tell; visible
   focus on everything interactive in the admin; AA contrast on the actual
   surface in BOTH day and night palettes; semantic elements (no onClick
   divs); accessible names on icon buttons.
10. **Responsive** — admin: verify at 375px — no horizontal scroll, ≥24px tap
    targets (44px in sticky bars), no hover-only actions, `dvh` not `vh`.
    Kiosk: verify in the circular crop — nothing load-bearing outside the
    disc, arc gesture zones unobstructed.

## Phase 2 — Audit before "done"

Mechanical: `npm run check:tokens` (token contract) and `npm test` (registry
coherence + invariants) both green. Greps over `src/{apps,core,components,admin}`
(expect zero, exceptions justified): `bg-gradient-|bg-clip-text|backdrop-blur`
· raw `#hex|rgba?(|hsl(` outside `index.css` token blocks · arbitrary `[Npx]`
values · `transition-all` · `animate-` outside the sanctioned ambient apps ·
`8884d8|82ca9d|strokeDasharray="3 3"` · emoji codepoints in chrome ·
`elevate|unlock|empower|supercharge|seamless|effortless` in copy.

Rendered passes: **squint** (one thing dominant, no identical section
anatomy) · **counts** (font sizes ≤7, radii/shadows ⊆ project scale, ≤1
saturated accent per viewport — per face, it's the rule) · **contrast**
(≥4.5:1, day AND night palette) · **keyboard** (admin: focus visible
everywhere) · **circle-crop** (kiosk) / **375px** (admin) · **hostile
fixtures** (offline, stale cache, empty playlist, 90-char device name, 3×
strings, mixed-sign data) · **ratchet** (distinct radii/shadows/sizes did not
grow vs. before the change).

## Phase 3 — Fix ladder

Never fix by bare deletion — slop is a **faked decision**. Find the job the
decoration was doing and do it with the system's device:

| Violation | Substitute |
|---|---|
| Gradient fill/text | Flat token; emphasis via size/weight/position; one accent word max |
| Glass/glow/orbs | Delete layer; separate via spacing → hairline → tint → card |
| Colored/new shadow | Project elevation; focus → focus ring; attention → hierarchy |
| Raw hex/px | The project's token (match by usage); none fits → propose it, don't inline |
| Off-scale value | Snap to the project's nearest scale step |
| New font/size/weight | Nearest declared style; emphasis = weight step, not new size |
| Emoji/icon leak | lucide at its sizes, or nothing |
| Loops/scroll FX outside ambient apps | Bind to real state change or render static |
| Copy register | Verb + object; unprovable adjective/number → delete the claim |
| Chart defaults | Project palette, plain line, linear/step, add unit, direct labels |
| Contrast fail | Move UP the ink/tone ramp or lighten surface — never one-off darker hex |
| Nested cards | Dissolve inner boundaries down the ladder, keep content |
| 3-card reflex/stat strip | Rank content; dominant cell for the answering item, rest → row/table |
| Happy-path only | Empty = sentence + creating action; loading = matched skeleton; error = cause + retry; offline = honest tell |
| Mock data as live | Honest offline/stale tell (WeatherApp pattern) — never silent fallback |
| Timer ticking while inactive | Gate the effect on `props.isActive` |
| Face broken at night | Consume `--face-*`; never fork a night variant of the component |
| Duplicate component | Delete new one; extend existing via its variant props |
| Ratchet growth | Converge onto existing steps; new steps enter via the token system only |

Report as: violation → rule area → fix applied. Re-run Phase 2 until clean.
