# RoundList + Todo — design

**Date:** 2026-07-21
**Status:** Awaiting review
**Scope:** The first of three platform pieces. Sync and voice get their own specs.

## Why this, why first

A suite audit produced twelve candidate apps (todo, notes, diary, learning
cards, smart home, music, health, messenger, Claude chat, alarms, shopping,
time logger). Nine of them are list browsers. The codebase has **zero list
primitives**, so building them today means nine bespoke scrolling
implementations on a circular viewport.

Three pieces of platform gate the suite:

| Piece | Unlocks | Blocked by |
|---|---|---|
| `RoundList` | 9 apps | nothing |
| Sync + storage | 11 apps | nothing |
| Voice capture | 5 apps | hardware decision (local STT vs API) |

`RoundList` goes first: no hardware dependency, no new services, widest unlock.
Todo is its proving consumer — the app that would be used daily, and the one
that also exercises storage and (later) voice capture.

This is the build-and-extract strategy [docs/architecture.md](../../architecture.md)
already argues for, applied to the app that earns it.

## Out of scope

Deliberately excluded so this ships:

- **Cross-device sync.** Todo persists to device-local storage for now, behind
  an interface that a sync layer can replace without touching the app.
- **Voice capture.** Todo gets manual entry only in v1. The capture pipeline is
  a later spec.
- **Tier-3 drill-down.** Todo is flat: one list, no projects or nested areas.
- **Any external service.** Not a Things client — Cultured Code exposes no API,
  and the unofficial routes are local SQLite and AppleScript, unreachable from
  a Pi.

## Part 1 — `RoundList`

### The problem

A 1080×1080 circular viewport loses roughly 22% of its area at the corners. A
naive full-width list clips its first and last rows against the bezel and runs
its text off the curve.

### Approach

A centred column at ~62% of viewport width, vertically scrollable, with the
top and bottom edges dissolved by a CSS mask so rows fade into the bezel
instead of being cut by it.

Three layouts were considered:

- **A · Centred column** — chosen. 5–6 rows visible, descriptions get full
  width, simplest to build.
- **B · Focus list** — one enlarged row, neighbours dimmed. Easiest to hit, but
  needs twelve steps to scan twelve items.
- **C · Arc-aware rows** — row width follows the chord. Most round-native, but
  truncates exactly the rows nearest the edges, which defeats the purpose.

The edge fade is borrowed from C: it buys the round-native feel without C's
truncation cost.

### API

```ts
interface RoundListProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => ReactNode;
  onSelect?: (item: T, index: number) => void;
  /** Row height in px. Default 96 — below ~72 the touch target is too small. */
  itemHeight?: number;
  /** Fixed content above the scroll area (title, count). */
  header?: ReactNode;
  /** Shown when items is empty. Required — an empty list must say why. */
  empty: ReactNode;
}
```

### Behaviour

- Column width `min(62%, 680px)`, centred.
- `overflow-y: auto` with `-webkit-overflow-scrolling: touch`. Touch and scroll
  are locked globally in `src/index.css`, so this opts back in locally — as the
  conventions require.
- Top and bottom fade via `mask-image: linear-gradient(...)`, ~64px each end.
- Minimum row height 72px. The panel is roughly 216 DPI, so smaller rows fall
  below a reliable touch target.
- No timers, no animation loop. Nothing to gate on `isActive`.
- Keyboard is not a consideration — the fleet is touch-only.

### Where it lives

`src/core/widgets/RoundList.tsx`, creating `src/core/widgets/` — the directory
[docs/architecture.md](../../architecture.md) designates for the primitive kit
and which does not yet exist.

### On extracting too early

The architecture doc rejects abstracting before three call sites. This spec
satisfies that: Todo is the first, the parked **kiosk app list** is the second
(already designed, needs a scrollable list of registered apps), and **Learning
cards** is the third. `RoundList` is written for Todo and only *frozen* as a
shared primitive once the app list consumes it unchanged. If the app list needs
the API to change, that is the signal the abstraction is wrong — and it is
better to learn that at call site two than at nine.

## Part 2 — Todo

### Shape

One flat list. A row is a title plus a completion state. Tapping toggles
completion. Two peer views switched by vertical swipe, following the
`HabitsApp` tier-2 pattern:

- **Active** — incomplete items, oldest first.
- **Done** — completed items, most recent first, with a clear-all action.

### Adding items

v1 is manual: a tap target at the top of the Active view opens a minimal
on-screen input. This is deliberately unpleasant — it is a placeholder that
exists so the app is usable before voice lands, not a design to invest in.
Voice capture replaces it.

### Storage

```ts
interface TodoItem {
  id: string;        // ulid, already a dependency
  title: string;
  done: boolean;
  createdAt: number; // epoch ms
  doneAt: number | null;
}
```

Persisted through a narrow interface:

```ts
interface TodoStore {
  load(): Promise<TodoItem[]>;
  save(items: TodoItem[]): Promise<void>;
}
```

v1 implementation writes namespaced, zod-validated `localStorage` under
`superclock:app:todo`. The interface exists so the sync layer replaces the
implementation rather than the app. Note the existing Fitness app writes a bare
`superclock-fitness-count` key with no namespace or validation — that is the
pattern being corrected here, and Fitness should migrate onto the same
interface once it exists.

**Known limitation, stated plainly:** until sync ships, a todo added on
fastclock is invisible on squareclock and does not survive a reflash. This is
acceptable for v1 only because the storage interface makes it a one-file fix.

### Registration

Adding an app means three lists must agree, or `npm test` fails:

1. side-import in `src/apps/index.ts`
2. entry in `ALL_KIOSK_APP_IDS` in `src/shared/capabilities.ts`
3. `app.todo` schema in `src/shared/schemas/` + `src/shared/schema-registry.ts`

Config schema `app.todo`: `showCompleted` (boolean), `maxItems` (number).

## Testing

- `RoundList` — renders N rows, fires `onSelect` with the right index, renders
  the empty state for `[]`.
- Todo store — round-trips items; rejects a malformed payload rather than
  crashing the kiosk on load.
- Registry coherence — the existing test must pass, proving all three lists agree.
- Navigation invariant — the existing `navigation.test.ts` must still pass;
  Todo registers a vertical-swipe callback and must clear it on deactivate.

## Acceptance criteria

1. `npm run build`, `npm run lint`, and `npm test` all pass.
2. Todo appears in the app grid and the admin's app list, with its description.
3. Adding, completing, and clearing items survives a page reload.
4. Vertical swipe moves between Active and Done; leaving the app clears the
   callback, and every gesture still works afterwards.
5. A list longer than the viewport scrolls, with rows fading at both edges
   rather than clipping against the bezel.
6. Verified in the browser preview at 1080×1080, not only by passing tests.

## Open questions

1. **Row actions beyond toggle.** Delete needs a gesture — swipe-left conflicts
   with app switching, so probably long-press. Deferring until the list is real
   enough to feel wrong without it.
2. **Ordering.** Manual reordering needs drag on a touch screen inside a
   scrollable container. Out of scope for v1; creation order only.
3. **Does the app list become the second consumer, or Learning cards?** The app
   list is simpler and already designed, so it is the current lean.

## Sequence after this

1. `RoundList` + Todo (this spec)
2. Kiosk app list onto `RoundList` — validates the abstraction at call site two
3. Sync + storage — replaces `TodoStore`, unblocks nine apps
4. Smart home — Home Assistant REST + websockets, needs only `RoundList`
5. Voice capture — the hardware-dependent piece, unblocks five apps
