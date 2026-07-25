# Kiosk Navigation Gestures — Design Spec

**Date:** 2026-07-24
**Owner:** Nick
**Status:** Approved
**Related:** `src/core/hooks/useGestures.ts`, `src/core/navigation.ts`, `src/core/navigation.test.ts`

## Problem

The kiosk has no physical buttons and today's gesture map is *conditionally* ambiguous: a vertical swipe cycles clock faces in ClockApp but opens the app grid in apps without a vertical callback. The same physical action doing different things reads as flakiness on a glanceable appliance. There is also no on-device settings surface, no way back out of an in-app drill-down, and no guaranteed escape gesture — gaps that block deeper apps (calendar day view, etc.) from ever shipping.

## Users & JTBD

- **Primary user:** Nick, at home, glancing at or walking past a clock. Single user — discoverability for guests is a non-goal.
- **Job to be done:** "I want to flip between apps, poke into one, and tweak brightness/sound without reaching for the admin app on another device."

## Approach

Split the round 1080×1080 touch surface into an **inner disc** and an **outer ring** (~70 px; touch-start distance from center > ~470 px). Classification happens at **drag start**: swipes starting in a ring arc are system gestures; swipes starting on the inner disc belong to the app (horizontal = global app switching, vertical = app-owned). Every gesture means exactly one thing in every state.

| Gesture | Meaning (always) |
|---|---|
| Inner disc, horizontal swipe | Switch apps (unchanged) |
| Inner disc, vertical swipe | App-owned (faces, views, drill-down); unclaimed = strict no-op |
| Bottom arc (6 o'clock ±45°), swipe up | Quick-settings panel |
| Top arc (12 o'clock ±45°), swipe down | App grid |
| Left arc (9 o'clock ±45°), swipe right | Back (drill-up; no-op at app top level) |
| 3-finger tap | Panic/home — default clock, from any state |

Right arc unassigned (falls through to horizontal app switch). Pinch-in stays as a **redundant** grid entry (decided 2026-07-25) — same outcome as the top arc, hedging rim-accuracy risk; it may be retired once the arc gesture proves reliable on hardware.

**Misfire mitigation** (rim touch is least accurate on these Waveshare panels, and fingers rest on the rim when handling the clock):

- **Peek-follow, not threshold-trigger:** the settings sheet / grid follows the finger from the rim; commits past ~40 % travel, else snaps back. Grazes become invisible.
- Edge gestures require origin-in-arc **and** inward travel ≥ 80 px.
- Settings/grid auto-dismiss after ~20 s idle; whole kiosk returns to the default face after ~5 min (reuses `lastGestureMs`).

### Alternatives considered

- **Grid as single hub** (settings gear inside the grid, no edge zones) — most consistent, near-zero new code, but gives apps no room for two-axis internal nav and puts settings two actions away. Rejected in favor of edge zones.
- **Round-native bezel dial** (circumference drag = rotate apps, radial long-press menu) — distinctive but nonstandard, hardest recognition work, worst rim-accuracy exposure. Rejected for v1; radial menu could return later as flair.

## Quick-settings panel

Sheet rises from the bottom arc, covers the lower half of the disc, content curved to the circle, large touch targets. Dismiss: swipe down, tap dimmed area, or 20 s timeout.

- **Brightness** — slider + night-mode toggle. Client-side (existing CSS dim layer from night-mode work).
- **Sound** — on/off + volume. Server endpoint drives the Fusion HAT speaker on fastclock; row hidden on devices without audio (capabilities gating).
- **Wi-Fi** — **read-only status**: network name + connection state. No toggle.

## Key Design Decisions

- **One gesture ⇒ one outcome, independent of app state.** — Predictability beats capability on a glanceable appliance. This is the core invariant; pin it in `navigation.test.ts` alongside the transition-key invariant.
- **Unclaimed inner-disc vertical swipe = strict no-op** (decision 2a) — keeping the old "opens grid" fallback would reintroduce the two-meanings problem the redesign exists to kill.
- **Back is a system gesture (left arc, 1a)**, delivered via a registerable callback next to `verticalSwipeCallback` — apps never render their own back button; unblocks drill-down apps.
- **Wi-Fi is status-only (3b)** — a wifi *toggle* on a device administered over wifi (Tailscale/admin/SSH) is a footgun requiring physical access to undo.
- **Settings is an overlay flag like `grid`, not a keyed AnimatePresence child** — mutually exclusive with grid, opens only from `app` mode; cannot strand the `transitioning` state.

## Constraints

- Round 1080×1080 viewport; the touchable area is a disc — edge detection is a radius+angle check, not a y-coordinate check.
- Pi-class hardware: no leaked timers; overlays must respect active-aware effect gating.
- Gestures stay in the single root `@use-gesture/react` handler (pointer events + capture); no per-app gesture handlers.
- `slow` (native LVGL) is out of this spec's scope — it has its own input path.

## Success Criteria

- Any gesture performed twice in different apps produces the same category of outcome both times.
- Drill-down into a sub-screen and back out works with no on-screen chrome.
- Grazing the rim while handling the clock causes no navigation (peek-follow snaps back).
- Kiosk always self-recovers to the default face within ~5 min of being left alone.

## Out of Scope

- Wi-Fi toggling or any network mutation from the kiosk.
- Guest discoverability (hint overlays, visible handles).
- Clean-lock / touch-disable mode.
- Bezel-dial / radial-menu interactions.
- The `slow` native device.

## Open Questions / Risks

- Ring width (70 px) and arc spans (90°) are educated guesses — tune on hardware, fastclock first. — Nick/Claude at implementation.
- Sound endpoint shape (per-device amp control via SunFounder sysfs) not yet designed. — implementation follow-up.
- ~~Does retiring pinch-in break any muscle memory worth keeping?~~ **Resolved 2026-07-25: keep pinch-in as a redundant grid entry** (Nick).

## Handoff Pointers

- Origin classification in `onDragStart`; branch existing `onDragEnd` on the stored classification.
- New nav-store surface: `settingsOpen` flag, `backCallback` registration, arc-gesture actions; extend `navigation.test.ts` with the one-gesture-one-outcome invariant.
- Peek-follow means the drag handler feeds an offset to the sheet/grid during the gesture, not just a fire-at-end event.

---

## Changelog

- 2026-07-24 — initial draft from approved brainstorm (decisions 1a, 2a, 3b).
- 2026-07-25 — pinch-in kept as redundant grid entry (was: retired); open question resolved. Build order approved: nav → calendar not-configured tell (parallel) → Timer/Todo → small proposals.
- 2026-07-25 — implemented (plan docs/superpowers/plans/2026-07-25-kiosk-navigation-gestures.md). Geometry constants live in src/core/gesture-zones.ts pending hardware tuning on fastclock. Execution amendments: (1) idle home-return defers to an active playlist — rotation must not fight the 5-min return, and it returns to the home APP, not a specific face; (2) grid entry commits at 80px travel without visual peek-follow in v1 (sheet has true finger-follow; grid follow deferred to hardware tuning); (3) arc-origin gestures never fall through to app gestures — the 50-79px band is a snap-back no-op, pinned in gesture-resolve.test.ts.
