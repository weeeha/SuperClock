# Concept adjudications

- **Date:** 2026-07-24
- **Status:** Accepted
- **Board:** [SuperClock fresh thinking](https://www.figma.com/board/JAjMCsw8hXx38locrxP5gd) — diagrams 1–9
- **Supersedes on conflict:** `docs/architecture.md` §Sequencing (see D1)

This is the first decision record in the repo. It exists because the SuperClock concept was
documented across fifteen files that had begun to disagree with each other, and because
four questions had been asked twice and answered differently each time.

`directive/foundation.md` remains authoritative on *intent*. This record is authoritative on
the four decisions below until a later record supersedes it.

---

## Context: the contract layer is real, the consumption layer is not

Four independent passes over the codebase — app registry, navigation and gestures, admin and
fleet pipeline, existing docs — found the same shape at every altitude.

| Contract | Declared | Actually consumed |
|---|---|---|
| App config schemas | 11 `app.<id>` schemas; the admin renders a form for each | **4 of 12** apps read the `config` prop at all |
| Face options | 8 `face.<id>` schemas | **1** face parses `faceConfig` (`AnalogClock.tsx`) |
| Complications | 6 registered | **1** draws live data; 8 of 9 faces declare `slots: []`, and the one face that declares slots hardcodes its complications anyway |
| Primitive kit | 7 named in `docs/architecture.md` | **0** exist; `src/core/widgets/` is not on disk |
| Swipe order | `appOrder` derived from registry + `enabledApps` | `AppGrid` ignores it — a separate hardcoded list of 14 entries renders 21 tiles, `clock` four times |
| `noteUserGesture` | in the navigation store's public API | never called anywhere in `src/` |
| `GET /api/device/state` | route exists | returns nulls; no consumer |

Stated plainly: **the admin is a remote control for a device that is mostly not listening.**

This single finding collapses three separately-felt problems — "apps are a junk drawer",
"fleet config is frictional", "unclear whether this is a clock or a platform" — into one.
The apps look inconsistent because most predate the config contract and never adopted it.
The fleet feels frictional because it is a control plane whose settings evaporate on arrival.

### What this implies about identity

`directive/foundation.md` defines SuperClock as "a smart-clock OS for round-LCD Raspberry Pis."
The code substantiates the *kernel* — registry, navigation store with a tested state machine,
capability model, atomic fsync'd fleet store with corrupt-file quarantine — but there is
**no standard library**. Seven primitives named, zero built, so every app re-rolls fetch,
interval, and localStorage by hand.

The verdict is therefore *platform, under-delivered* — not *platform, over-claimed*. The
contracts are right. The debt is that nothing honours them yet.

Note the limit this exposes in the tooling: `src/shared/registry-coherence.test.ts` rigorously
proves the three registry *lists* agree, which is why nothing is ever missing. It cannot prove
a schema is ever *read*, which is why so much is inert. Structural consistency was automated;
semantic consistency was not.

---

## D1 — Todo via RoundList is the forcing function

**Conflict:** `docs/architecture.md` names Fitness as the app that earns the primitive kit
(it stress-tests 5 of 7 primitives). The later `docs/superpowers/specs/2026-07-21-roundlist-and-todo-design.md`
names Todo. Both invoke the same build-and-extract strategy.

**Decision:** Todo, via RoundList.

**Why:** RoundList has no hardware dependency and unlocks 9 of 12 planned apps — nine of the
twelve candidates are list browsers and the codebase has zero list primitives. Todo is the
proving consumer; the kiosk app list is call site two and validates the abstraction before
nine apps depend on it.

**Consequence:** `docs/architecture.md` §Sequencing is superseded on this point. Its
falsifiable criterion still applies, retargeted: if Todo lands cleanly on RoundList and the
app list consumes it unchanged, the extraction model is proven.

## D2 — Complications get wired up, not deleted

**Conflict:** The system is a facade. `docs/site/index.src.html` ranks it gap #1 and calls it
"the worst kind of gap, because it looks finished". Deleting it was the cheaper option.

**Decision:** Make it real. Faces consume their declared slots; the six registered
complications get backed by live data.

**Why:** Complications are a genuine watch-face concept, the admin UI (`SlotGrid`,
`ComplicationPicker`) already exists, and the registry shape already anticipates broadening
beyond Clock. Deleting would discard working UI to solve a wiring problem.

**Consequence:** Larger job than deletion. Until it lands, the facade must be labelled as such
wherever it is visible — the admin currently lets you assign a complication to a screen that
will never render it.

## D3 — The shared JSON face spec comes after the primitive kit

**Conflict:** `docs/site/index.src.html` gap #5 calls face-spec-as-data "the highest-leverage
mid-term move"; the fable-5 health report recommended deciding it *before* `slow-native` makes
it three-of-N hand-synced faces.

**Decision:** Sequence it after the primitive kit.

**Why:** Primitives unblock nine apps and are unblocked today. The face spec is leverage but
blocks nothing currently being built.

**Consequence:** Hand-synced faces are capped at Minimalismo in the meantime. Any new face
shared between React and LVGL is a future migration and should be argued for explicitly.
The `CLAUDE.md` §React ↔ LVGL face parity rule stays in force until the spec exists.

## D4 — The unread config schemas get wired, not deleted

**Conflict:** Eight of twelve apps ignore the config the admin writes for them. Deleting the
unread schemas would make the admin small and honest immediately.

**Decision:** Keep the contract, make it real. Wire the apps to the schemas that already
describe them.

**Why:** Config-driven apps are the point of the fleet pipeline; deleting the schemas would
retreat from the platform story to make a symptom go away. `CalendarApp.tsx` is already the
reference implementation — `schema.safeParse(config ?? {})` with a defaults fallback — so
this is a pattern to copy, not to design.

**Consequence:** Two apps (`time-tracking`, `breathing`) currently read config via a raw
`as Partial<T>` cast rather than `safeParse`, so malformed saved config flows through
unvalidated. Those should move onto the Calendar pattern as part of the same work.
`QuoteApp` and `FitnessApp` declare no props at all and need signatures before they need config.

---

## Still unresolved

**Hardware truth is forked.** `CLOCK_SPECS.txt` (2026-05-07) and the four
`superclock-*/device.json` files disagree about what `small` and `slow` actually are.
`superclock-small/device.json` is a stub with display, SBC, IP and MAC all "TBD".
Neither file is read by any TypeScript — `src/shared/capabilities.ts` is the code-level source
of truth — so this is a documentation defect, not a runtime one. It still needs one owner.

---

## Latent defects found while mapping

Not part of the concept work; recorded here so they are not lost.

1. **`settings.presence` can permanently break the admin's Settings save.**
   `src/shared/types.ts` declares it and two consumers read it
   (`server/display-adapter.ts`, `src/core/components/PresenceShade.tsx`), but
   `deviceSettingsSchema` in `src/shared/device-config-schema.ts` is `.strict()` and omits it.
   `Settings.tsx` spreads the existing settings object wholesale on save, so once a device
   acquires a `presence` key every settings PATCH 400s.

2. **A single-app config wedges the kiosk permanently.** With `appOrder.length === 1`,
   `swipeToNext` does not change the `activeInstanceId ?? activeAppId` render key, so
   `AnimatePresence` runs no exit animation, `finishTransition` never fires, and `mode` sticks
   at `'transitioning'` — where every gesture is gated off. This is the exact invariant
   `src/core/navigation.test.ts` exists to protect, and the single-app case is the one it
   does not cover. `appOrder.length === 0` yields `activeAppId = undefined` via `% 0`.

3. **The 3-finger detector leaks pointers.** The live-pointer `Set` in
   `src/core/hooks/useGestures.ts` never resets on blur or `visibilitychange`, so one dropped
   `pointerup` biases it permanently and later two-finger touches start opening the grid.

4. **Playlist rotation interrupts in-app interaction.** Only `swipeToNext`, `swipeToPrev`,
   `showGrid` and `hideGrid` stamp `lastGestureMs`. Paging the calendar, cycling clock faces,
   and every in-app tap do not — so the playlist can rotate the screen away mid-interaction.
   `noteUserGesture` was written for exactly this and is never wired up.

---

## Amendments this record implies

- `docs/architecture.md` §Sequencing — Fitness is no longer the forcing function (D1).
- `README.md` — still documents `VITE_GITHUB_TOKEN` as a browser variable after the token
  moved server-side, and lists 11 apps where 12 are registered. It contradicts the
  secrets-are-server-side rule in `CLAUDE.md` and blocks open-sourcing.
- `directive/foundation.md` §Open decisions — decision 3 (sequencing) and the face
  contribution model lean are now partially settled by D1 and D3.
