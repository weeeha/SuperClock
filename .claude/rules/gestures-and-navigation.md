---
paths:
  - "src/core/**/*.{ts,tsx}"
  - "src/apps/**/*.tsx"
summary: "**Gestures and the nav-store contract** — arc zones, the `mode: 'transitioning'` invariant and the guarded-cleanup shape live in `.claude/rules/gestures-and-navigation.md` (loaded automatically when you touch `src/core/**` or an app component). Gated as `NAV-1`/`NAV-2` in `rules/superclock.json` and by `src/core/navigation.test.ts`."
---

# Gestures and navigation state

Loaded when you touch `src/core/**` or an app component, because that is when
these invariants can be broken. The one-line rule lives in AGENTS.md; this is
the body.

## Navigation state (Zustand)

`src/core/navigation.ts` is the single source of truth: `mode: 'app' | 'grid' | 'transitioning'`, `activeAppId`, `activeInstanceId`. `SwipeContainer` keys its AnimatePresence child on `activeInstanceId ?? activeAppId` — **every action that sets `mode: 'transitioning'` must change that key**, or `onExitComplete → finishTransition()` never fires and all gestures die (they gate on mode). This invariant is pinned by `src/core/navigation.test.ts`. The store is `window.__nav` in dev. The same store also carries the overlay/back-gesture state consumed by Gestures below (`settingsOpen`, `peek`, `backCallback`) — none of it participates in the mode/transitioning contract above.

## Classification

Classification is split into two pure, unit-tested functions; `src/core/hooks/useGestures.ts` is a thin dispatcher over them — one root `@use-gesture/react` handler (pointer events, pointer capture — no per-app gesture handlers). `src/core/gesture-zones.ts` classifies the touch **origin** at `onDragStart` — disc center + radius/angle math, not a y-coordinate check — into `inner | top-arc | bottom-arc | left-arc | right-arc` (a ~70px-equivalent outer ring, `RING_FRACTION`, tuned on hardware). `src/core/gesture-resolve.ts` takes that zone plus live nav state at drag end and returns exactly one `DragAction` tag; the handler only dispatches.

## Arc map

Arc map (app mode): **top-arc swipe down → grid**; **bottom-arc swipe up → quick-settings**, with peek-follow (`nav.peek` tracks the finger) and commit at `COMMIT_PROGRESS` (40% of sheet height, min `ARC_MIN_TRAVEL` 80px); **left-arc swipe right → back**, dispatched through registerable `backCallback` (Calendar is the reference consumer; `BackChevron` is deleted — apps never render their own back chrome); **right-arc is unassigned**, falls through to inner behavior. **An assigned-arc origin owns its gesture**: sub-threshold travel is a snap-back no-op, it never falls through to the app gesture underneath — one gesture, one outcome. Unclaimed inner-disc vertical swipe (no `verticalSwipeCallback` registered) is a **strict no-op**, there is no grid fallback anymore. 3-finger tap and pinch-in are unchanged and still open the grid (pinch-in kept deliberately as a redundant entry point alongside the top-arc swipe).

`backCallback` follows the **same registration/cleanup contract as `verticalSwipeCallback`** below — copy it exactly, including the guarded cleanup. Both are gated as `NAV-1`/`NAV-2` in `rules/superclock.json`.

`settingsOpen` is a boolean **flag**, deliberately not a `NavMode`: mutually exclusive with `grid`, but it must never touch the `mode: 'transitioning'` contract above (opening/closing the sheet can't strand a swipe transition). Its brightness/night writes go through `src/core/local-overrides.ts`, which yields to the admin/scheduled base: an override wins only until the base it was set against changes, then it's silently spent. `src/core/hooks/useIdleReturn.ts` dismisses overlays after 20s idle and returns to the home app after 5min, **deferring only the home-return** (not overlay dismissal) while `isPlaylistDriving()`.

## Multi-view apps and the guarded cleanup

**Vertical-swipe view cycling is the blessed multi-view pattern** (decided 2026-07-24): an app with more than one view registers the callback and cycles views on swipe up/down, sacrificing swipe-down-to-grid (the grid stays reachable via 3-finger tap / pinch-in; by convention swipe-down at the app's view 0 still falls through to `showGrid()`). HabitsApp is the reference implementation — copy its registration/cleanup shape exactly, **including the guarded cleanup**: capture the callback in a const and only null the store slot if `useNavigation.getState().verticalSwipeCallback === cb` (SwipeContainer's `popLayout` keeps the exiting app mounted after the next app registers, so an unconditional null in unmount cleanup stomps the incoming app's registration). The users are the apps declaring `multiView` in `src/shared/app-capabilities.ts` (a list held to the code by `app-capabilities.test.ts`, so it is not repeated here). Multi-view apps show Habits-style pager dots.
