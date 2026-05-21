# SuperClock — Architecture & Roadmap

Working document. Captures the app catalog, primitive kit, navigation model, and sequencing as understood today. Update as patterns emerge or new apps land.

For project-level direction this serves, see [directive/foundation.md](../directive/foundation.md).
For admin / face / complication subsystem details, see [docs/admin/foundation.md](admin/foundation.md).

## App catalog

11 apps registered today + ~15 in design. Grouped by **layout archetype**:

| Archetype | Apps (have + planned) | What it is |
|---|---|---|
| **Ring face** | fitness-counter, claude-usage, time-tracking states, several clock faces | Center subject + perimeter arc(s) + label |
| **Radial viz** | github, habits-monthly, weather-hourly *(planned)*, moon *(planned)*, week-stats *(planned)* | Perimeter-as-time data plot |
| **Scene picker → detail** | nature *(planned)*, fireplace, breathing *(planned)*, music *(planned)*, photo-library *(planned)*, fitness-groups *(planned)*, todo *(planned)* | List of pickable cards → tap → scene with controls |
| **Static composition** | quote, weather-current, calendar | Fixed centered layout |
| **Round-list browser** *(no impl yet)* | todo, music tracks, audiobook chapters, fitness sets, chat history | Center-column vertical scroll with edge margins |
| **Special — Clock** | clock | Face-cycling shell hosting N swappable faces |
| **Special — Claude** | claude-usage (have) + claude-chat *(planned)* + claude-voice *(planned)* | Three modes of conversation/observation |

**Multi-view apps** (peer sub-views): weather (4 views), timer (2 modes), habits (2), fitness (3 nested levels), claude (3), nature (picker→detail), clock (face cycle), todo (review/do modes). The shell currently knows tier 0–1; tiers 2–3 are app-DIY today.

## Primitive kit

Extracted from the catalog above. Target location: `src/core/widgets/` once built. None exist yet as shared primitives.

| Primitive | Used by ≥ | Notes |
|---|---|---|
| `RingFace` | 5+ apps | Center subject + arc(s) + label; the "ambient face" pattern |
| `RadialViz` | 6+ apps | Generic perimeter-as-time plot: takes a count + per-position renderer |
| `ScenePicker` | 6+ apps | List of cards → tap → scene with controls |
| `IntervalTimer` | 4+ apps | Sequenced countdown (timer app, fitness sets, breathing, pomodoro) |
| `RoundList` | 5+ apps | Center-column vertical scroll; ~60% width with edge fade |
| `WeekRing` | 5+ apps | Statistics summary block — 7 dots/arcs for the week |
| `AmbientMedia` | 3+ apps | Video/audio + crossfade |

## Shell-level extracts

Cross-cutting concerns currently re-rolled per app. Target location: `src/core/hooks/`.

| Capability | Used by | Notes |
|---|---|---|
| Peer sub-view swiping (tier 2) | 8+ apps | Honor `supportsInternalSwipe` from app metadata; defer when app handles it |
| Drill-down + back stack (tier 3+) | 4+ apps | Fitness needs 3 nested levels |
| `useScopedStorage(appId)` | 5+ apps | Namespaced localStorage with zod schema |
| `useCachedFetch(url, { refreshMs, requiresActive })` | 4+ apps | Polled fetch with isActive gating |
| `useInternalSwipe(handlers)` | 3+ apps | Standardize touch math |

## Navigation hierarchy

```
Tier 0 — App grid          (have: AppGrid)
Tier 1 — App primary view  (have: SwipeContainer routes to lazy app)
Tier 2 — App sub-views     (peers; swipe left/right within app — app-DIY today)
Tier 3 — Drill / detail    (back stack — app-DIY, only fitness needs 2+ deep)
```

Tiers 2 and 3 are the missing shell capability. Lifting them into the shell is the highest-leverage refactor once enough multi-view apps exist to validate the API. See sequencing below.

## Customization spectrum (open decision #1)

For community-contributed faces. One of:

- **A) Curated React** — only PRs add faces. Type-safe, beautiful by default; no new faces without a deploy. *Status today.*
- **B1) Pure config on top of engines** — JSON faces in a folder; community-friendly. *Matches existing infrastructure ([face-registry](../src/shared/face-registry.ts), [schema-form](../src/admin/lib/schema-form.tsx), per-instance config). Current lean.*
- **B2) Config + community engines** — B1 plus contributors can add new engines with code review.
- **C) Designer tool** — eventually a web face-builder; output is JSON. Incremental from B1/B2.

The customization Nick wants for clocks (background image / color, hand styles, dot styles) is squarely B1 territory. Going to C later is non-breaking — the designer just outputs the same JSON the engines already consume.

## Sequencing strategy (current lean)

**Build-by-hand-and-extract.** Build the next demanding app, *consciously* identifying primitives as you go. Extract on third use (Rule of Three).

The next-build candidate is **Fitness** (the real one: groups → sets → active circuit). It stress-tests:
- `ScenePicker` (groups list)
- `RoundList` (sets list — first true list-on-circle test)
- Drill-down + back stack (3 levels deep)
- `IntervalTimer` (15 × 1min sequence)
- `WeekRing` (workout stats)

If Fitness lands in ~150 lines of app code because the kit is right, the model is proven. If primitives don't naturally fall out, the primitive model needs rework before more apps land on it.

Alternative considered: primitives-first. Rejected for now — abstractions designed without enough call sites tend to over-fit.

## Cross-cutting concerns to design once

- **Statistics.** Every "do something daily" app wants a weekly/monthly summary. Implement as a `WeekRing` widget that any trackable app drops in; data via a shared `useDailyTotals(appId)` hook.
- **Persistence.** Apps use various localStorage keys with various JSON shapes. `useScopedStorage(appId, schema)` standardizes namespacing and validation.
- **Data fetch + refresh.** Weather/calendar/github/claude-usage each implement their own setInterval + fetch + isActive gating. `useCachedFetch(url, { refreshMs, requiresActive })` centralizes.
- **Internal-swipe gestures.** Apps that consume horizontal swipe (clock face cycling, habits day/month) hand-roll. Wire `supportsInternalSwipe: true` from app metadata into the root `useAppGestures` hook so the shell defers when the app handles it.

## Roadmap (rough, open to amendment)

**Near (horizon 1, weeks):**
- Build Fitness app; extract `RoundList`, `IntervalTimer`, `ScenePicker`, drill-down nav as it forces them.
- Build Weather hourly + Timer to validate the multi-view shell.
- Promote the most-used primitives into `src/core/widgets/`.

**Mid (horizon 2, months):**
- Lock B1 face engines (analog, digital, flip). Define schemas. Wire live preview in admin.
- Document the primitive kit so external contributors can write a new app in < 100 lines.
- Open-source the repo; first external contributor PR is the bar.

**Far (horizon 3, > 6 months):**
- Device-to-device push channel (admin → device → device).
- Claude voice mode.
- Visual face builder.
- Community face manifest / library.

## Open working questions

These resolve in PRs or follow-up brainstorms, not here:

- Should **Photo library absorb Photo Frame** (interactive vs ambient modes of the same data)?
- Should **Nature absorb Fireplace** (scenes are scenes)?
- Should **Music absorb Audiobook** (same data shape, same controls)?
- Should **Claude metric / chat / voice** be one app with three sub-views or three apps?
- Where does the `RoundList` primitive draw its content margin — fixed % or device-config?
- Do widgets/complications come from the Clock app's complication registry, or from a broader registry any app contributes to? (See decision 8 in [docs/admin/foundation.md](admin/foundation.md) — broadening is anticipated.)
- When does the kiosk pick up TanStack Query for shared data hooks? (Already a dep; not yet wired into shared providers.)

## App template (target, post-primitives)

What a new app should look like once the primitive kit lands. Aspirational — not all primitives exist yet.

```tsx
// src/apps/example/index.ts
import { lazy } from 'react';
import { registerApp } from '../../core/registry';

registerApp({
  metadata: {
    id: 'example',
    name: 'Example',
    icon: '/icons/example.png',
    supportsInternalSwipe: true,
  },
  component: lazy(() => import('./ExampleApp')),
});

// src/apps/example/ExampleApp.tsx
import { RingFace, WeekRing } from '../../core/widgets';
import { useScopedStorage, useSubViews } from '../../core/hooks';

export default function ExampleApp({ isActive }: AppProps) {
  const [data, setData] = useScopedStorage('example', schema);
  const view = useSubViews(['today', 'week']);

  if (view.current === 'today') {
    return <RingFace center={<Icon />} arc={data.progress} label={data.label} />;
  }
  return <WeekRing values={data.weekly} />;
}
```

If the average new app fits this template at ≤ 50 lines, the kit is succeeding.
