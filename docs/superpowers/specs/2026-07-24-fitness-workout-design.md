# Fitness — 7-minute workout watchface

**Date:** 2026-07-24
**Status:** Design approved, ready for implementation planning
**Scope:** Spec A of two. Spec B (character animation pipeline) is deferred and outlined at the end.

## Goal

Turn the `fitness` app from a tap-to-increment rep-counter stub into a guided
circuit runner modelled on the Seven (7-minute workout) app, rendered as a
watchface in the design language already drawn in Figma
(`Clock-Design-WIP`, node `681:25972` — "Watchface 12 / Plugin 7 Fitness").

The core loop is Seven's: a fixed circuit of 12 bodyweight exercises,
**30s work / 10s rest**, ordered so consecutive exercises hit different muscle
groups. Zero decisions once the workout starts.

## Non-goals

Explicitly out of scope, listed so they are not silently reintroduced:

- **No exercise database.** See "Why there is no exercise database" below.
- **No browsable exercise library.** Would be a separate spec.
- **No rep counting.** The app is workout-only; the number on the face is
  always a countdown, never a rep tally.
- **No heart-rate or calorie display.** Seven shows both; we can measure
  neither. (The A121 radar on `superclock-fast` can report presence, but
  presence is not fitness data and is excluded.)
- **No 7-month challenge or pause-day banking.** Deferred; see "Streak".
- **No live 3D / WebGL at runtime.** Ruled out on measured evidence; see
  "Spec B preconditions".

## Decisions and rationale

Recorded so the reasoning survives the conversation that produced it.

| Decision | Rationale |
| --- | --- |
| Do-first circuit runner, not a browsable library | Seven's value is that pressing go requires no decisions. A library is a different product. |
| Target `superclock-fast` (1080×1080) first, layout kept adaptive | Fastest path to something real; avoid hardcoded 1080 values so `superclock-square` (800×480) is a later CSS pass, not a rewrite. |
| Extend the existing `fitness` app rather than add a new one | The current stub is already a placeholder pointing at this exact design — same 1000×1000 viewBox, same cream `#f5f0eb`, same `#e33030 → #8b1a1a` ring gradient, same default count of 33, same three hearts. Reusing the id avoids all registry churn. |
| Workout-only; the number is always a countdown | Chosen over a dual-purpose idle/workout face. Simpler state model and a single meaning for the largest element on screen. |
| Beeps **and** pre-recorded voice clips | Audio is what actually drives the workout — you are not looking at the screen mid-burpee. Voice clips are generated offline, so quality does not depend on Pi TTS. |
| Pure reducer + thin React view | A 12-exercise circuit has edge cases (pause mid-rest, skip on the last exercise, deactivation at second 27, midnight rollover) that are cheap to test as a reducer and expensive to test through React. Matches the repo's existing invariant-pinning tests. |
| Split into Spec A (app) and Spec B (animation pipeline) | The app can ship to the wall with a static character while the animation pipeline — which holds nearly all the unknowns — iterates independently behind a fixed interface. |

### Why there is no exercise database

The original framing was "a database of exercises, grouped together", and
`yuhonas/free-exercise-db` (873 exercises, Unlicense, offline-capable) was
researched as the source.

It drops out of the design because of what the stripped watchface actually
needs per exercise: a **name** and an **animation**. It shows no instructions,
no muscle groups, no equipment tags, no difficulty. And the images — the only
reason that dataset won over the alternatives — are replaced by a custom
character.

So the exercise set becomes a hand-written TypeScript constant. This removes
three problems at once:

- the ~98 MB image payload,
- the licensing question around commercially-owned exercise media,
- the gap where several canonical Seven exercises (jumping jacks, wall sit,
  burpee, high knees) are absent from the dataset entirely.

If a browsable library is wanted later, it is a new spec with its own data
source, not an extension of this one.

### Rejected: `hasaneyldrm/exercises-dataset`

Considered because it ships animated GIFs of a consistent character — exactly
the visual target. Rejected on two independent grounds:

1. **Licensing.** Its `LICENSE` carries a `MEDIA EXCEPTION`: the MIT licence
   covers only code, tooling, structure and instruction text. The media is
   © Gym visual, and "Cloning this repository does not grant you any license
   to the media; obtain your own from Gym visual." `weeeha/SuperClock` is a
   **public** repo, so bundling that media into `public/` would be
   redistribution, not use.
2. **Resolution.** The assets are 180×180, intended for phone list
   thumbnails. The target window is a ~500px circle on a 1080×1080 panel;
   upscaling 2.5× would look soft beside the existing crisp SVG faces.

Buying a licence from Gym visual for ~12 exercises remains a legitimate option
if the custom-character route stalls, but the resolution objection stands
regardless.

## Architecture

### Data model — `src/apps/fitness/exercises.ts`

```ts
interface Exercise {
  id: string;                           // 'push-ups' — also the art + voice asset key
  name: string;                         // 'Push-ups' — caption and voice-clip label
  target: 'upper' | 'lower' | 'core';   // validated for alternation, not displayed
}

interface Workout {
  id: string;            // 'full-body'
  name: string;          // 'Full Body'
  exerciseIds: string[];
  workSeconds: number;   // 30
  restSeconds: number;   // 10
  rounds: number;        // 1
}
```

`target` exists solely so a test can assert Seven's alternation property,
preventing a future edit from silently producing three core exercises in a row.

**Three workouts, one 12-exercise pool.** `exercises.ts` defines exactly 12
`Exercise` entries; the three `Workout` definitions select from that pool:

| Workout | Exercises | Alternation enforced? |
| --- | --- | --- |
| `full-body` | all 12, ordered upper → lower → core | **Yes** |
| `core` | the 4 core-targeting exercises | No |
| `lower` | the 4 lower-targeting exercises | No |

The alternation invariant applies **only to `full-body`**. It is meaningless
for the targeted workouts — a core workout is core exercises by definition —
and asserting it globally would make those workouts impossible to define.
Their subsets are shorter, so `rounds` is the intended way to lengthen them.

### Circuit engine — `src/apps/fitness/circuit.ts`

One pure function, no React, no timers, no module-level clock reads:

```ts
type Phase = 'ready' | 'countdown' | 'work' | 'rest' | 'paused' | 'complete';

type CircuitEvent =
  | { type: 'START'; workoutId: string; now: number }
  | { type: 'TICK'; now: number }
  | { type: 'PAUSE'; now: number }
  | { type: 'RESUME'; now: number }
  | { type: 'SKIP'; now: number }
  | { type: 'ABORT' };

function reduce(state: CircuitState, event: CircuitEvent): {
  state: CircuitState;
  cues: Cue[];   // e.g. [{ kind: 'beep', tone: 'work' }, { kind: 'voice', id: 'push-ups' }]
};
```

Two load-bearing properties:

**`now` is injected on every event and never read inside the reducer.** The
engine is fully deterministic, so a test drives a complete 7-minute circuit in
under a millisecond with synthetic timestamps — no fake timers, no waiting.

**Time is derived, never accumulated.** State holds `phaseEndsAt` as an
absolute epoch milliseconds value; `remaining = phaseEndsAt - now` is
recomputed on every tick. Drift becomes structurally impossible rather than
merely small. (`setInterval` accumulation would visibly drift across a
7-minute circuit.)

**Audio cues are returned as data, not fired as side-effects.** The reducer
emits the cues that should play; the React layer only plays them. "Does it
beep at exactly 3·2·1, and announce the next exercise during rest rather than
during work?" becomes an assertion on an array instead of something verified
by standing in front of the clock.

### Screens

Six phases, all rendered in the Figma language: black bezel, cream `#f5f0eb`
disc, red→orange progress ring with a comet at the leading tip, large dark
number, hearts.

| Phase | Face |
| --- | --- |
| `ready` | Workout name, "tap to start · 7 min", empty ring. |
| `countdown` | 3·2·1 only, character hidden, one beep per second. |
| `work` (30s) | Ring drains as the exercise timer, comet at the tip, character performs the move, hearts shown. |
| `rest` (10s) | **Face inverts to dark**, next exercise named, character in a neutral pose. |
| `paused` | Colour drained to greys, pause glyph, position shown ("4 of 12"). |
| `complete` | Ring closed, elapsed time, streak. Auto-returns to `ready` after 20s so the wall never sticks here. |

**Rest inverts lightness rather than hue.** Seven flips cyan→orange to make
state readable across a room. This palette is already red/orange, so a hue
flip has nowhere to go; inverting the disc to dark achieves the same
at-a-glance legibility and carries the right meaning — rest reads as "off".
This is a visual proposal to validate on the device.

### Gestures

Registered through `setVerticalSwipeCallback` while active, following the
`HabitsApp` pattern including the fall-through to `showGrid()` on swipe-down.

| Phase | Tap | Swipe up | Swipe down |
| --- | --- | --- | --- |
| `ready` | start | next workout | grid |
| `work` / `rest` | pause | skip exercise | grid |
| `paused` | resume | abandon → `ready` | grid |
| `complete` | → `ready` | — | grid |

**Opening the grid pauses; switching apps suspends.**

`SwipeContainer` passes `isActive={mode !== 'grid'}` and keys its child on the
active app id. So opening the app grid over a running circuit sets
`isActive: false` and pauses it — close the grid and it resumes at the same
second. Swiping to a *different* app changes the key instead, which unmounts
the component outright; see the next section for how that case is handled.

### Resuming after a swipe-away

An earlier draft of this spec claimed swipe-away paused and swipe-back
resumed. It didn't — that was aspirational text describing behaviour that
hadn't been built yet, and the code comment asserting it was wrong too. Both
have since been corrected: swipe-away now genuinely suspends and resumes.

The gap was that `SwipeContainer` passes `isActive={mode !== 'grid'}` and
keys its child on the active app id. Opening the app grid over a running
circuit re-renders `FitnessApp` with `isActive: false`, which the existing
effect correctly pauses. But swiping to a *different* app (or playlist
auto-rotation in `core/playlist.ts`, which rotates via `switchToInstance` on
an interval — the same unmount path) changes that key and unmounts the
component outright. It never re-renders with `isActive: false`, so the pause
effect never fires, and a plain `useState` circuit died with the component.

This is fixed with `src/apps/fitness/circuit-store.ts`, a module-level store
following the `brightness-lease.ts` pattern (module-level value, a listener
set, an emit function — free of `window`/DOM so it stays unit-testable).
`FitnessApp`'s unmount cleanup (the effect with an empty dependency array, so
it only fires on a real unmount, not an `isActive` flip) reduces a `PAUSE`
event through the circuit reducer and suspends the *paused* result — pausing
first matters, because `phaseEndsAt` is an absolute epoch, and suspending a
still-running state would compute a massively negative remaining time on
resume and jump straight to `complete`. The next mount seeds its initial
state from `takeSuspendedCircuit(workout.id, Date.now())` instead of always
starting `ready`.

`takeSuspendedCircuit` is take-once (a second matching take returns `null`,
so a stale entry can't be resurrected twice) and additionally refuses to
hand back an entry when: the entry is older than `SUSPEND_TTL_MS` (30
minutes — coming back a day later and finding yourself paused at exercise 4
is confusing, not helpful); or the saved phase is `ready`/`complete`
(nothing worth resuming). Those two checks only run — and only consume the
entry — once the workout id has already matched.

A workout-id **mismatch** (resuming a `core` circuit into a `full-body`
workout would index into the wrong exercise list) also returns `null`, but
leaves the entry untouched rather than clearing it: `device-config-schema.ts`
allows more than one fitness instance per device (its `instances` array), so
a mismatch here just means "not mine, not necessarily invalid" — a different
instance's mount may still be the rightful owner and should be able to claim
it afterwards. The suspension is cleared explicitly on `ABORT` and on
reaching `complete`, so a finished or abandoned workout can never be resumed
from a later, unrelated mount.

Resuming is never automatic — the restored state is already `paused`, and
the user taps to resume, same as pausing via the grid. Silently continuing a
workout because the kiosk swiped back to it would be surprising.

Playlist auto-rotation itself is not suppressed while a circuit runs; a
kiosk that rotates through the fitness app will still interrupt it, but the
workout survives the interruption now instead of being discarded.
Suppressing rotation entirely while a circuit is active would be a separate,
smaller fix if it turns out to be wanted.

### Kiosk integration

**Brightness lease — a core change, not an app-local trick.**
`useApplySettings` dims the kiosk via `root.style.filter = brightness(...)` on
`<html>` ([apply-settings.ts:76](../../../src/core/apply-settings.ts)). A CSS
filter on an ancestor cannot be undone by a descendant, so an app cannot opt
out from inside itself — a workout at 22:30 would otherwise be dimmed
mid-burpee.

Add `src/core/brightness-lease.ts` holding an **expiry timestamp**, consulted
by `useApplySettings` when choosing the effective brightness. The fitness app
acquires a lease while a circuit is running and releases it on
complete/abort/unmount.

Expiry rather than a boolean is deliberate: a crashed or wedged kiosk must not
pin the panel at full brightness all night. This mirrors the existing radar
lease, whose 90s server-side expiry guards the same failure mode.

**Audio.** The kiosk already launches Chromium with
`--autoplay-policy=no-user-gesture-required` (verified in both
`scripts/kiosk.sh` and `~/.config/labwc/autostart` on `superclock-fast`), so
no unlock gesture is required. Beeps are synthesised via WebAudio with no
assets. Voice clips are pre-generated offline. **All clips for a workout are
preloaded when the circuit starts**, never fetched at the transition — an
announcement arriving 200 ms after the boundary is worse than silence.

Hardware confirmed present on `superclock-fast`: `aplay -l` lists
`card 2: snd_rpi_googlevoicehat_soundcar` (the Fusion HAT I2S DAC).
**Not yet verified: that audio is physically audible** — the SunFounder
speaker amp may need a sysfs enable. This must be confirmed with a real
`aplay` test before implementation depends on it.

### Config schema — `src/shared/schemas/app.fitness.ts`

Fully replaced. The current fields (`exercise`, `dailyGoal`, `resetAt`) are
rep-counter concepts with no meaning under a workout-only app.

| Field | Type | Default |
| --- | --- | --- |
| `workoutId` | `'full-body' \| 'core' \| 'lower'` | `'full-body'` |
| `workSeconds` | int 10–120 | `30` |
| `restSeconds` | int 0–60 | `10` |
| `rounds` | int 1–5 | `1` |
| `voiceCues` | boolean | `true` |
| `beeps` | boolean | `true` |
| `keepBright` | boolean | `true` |

**Migration is optional, not required.**
`screenInstanceSchema` types per-instance app config as
`config: z.record(z.string(), z.unknown())` — an opaque record. The `.strict()`
calls in `device-config-schema.ts` wrap the instance envelope
(`id`/`appId`/`config`/`label`), not the config contents, so the per-app
schema is never enforced at the device-config layer. Stale keys therefore
validate fine, and the kiosk's `fitnessAppSchema.parse()` (a plain `z.object`,
which strips unknown keys by default) discards them and applies defaults.

A `FLEET_SCHEMA_VERSION` v3 step to strip the dead keys is worthwhile tidying
but **must not block shipping**.

### Streak

Deliberately smaller than Seven's. Ship only what the Figma already draws:
**three hearts per calendar month**, one lost per missed day, reset monthly,
rendered as ❤️❤️🖤.

Seven's 7-month challenge and 30 bankable pause days are real mechanics but
are meaningless until hearts have been accumulating for a while, so they are
deferred rather than designed-in-and-unbuilt.

**Settling missed days must be idempotent.** The function that charges hearts
for missed days runs on every day-rollover tick, and on a kiosk that sits on
this screen for weeks it will be called repeatedly with its own previous
output. If it charges for a gap without recording that it charged, it
re-charges the same gap every call and hearts collapse to zero. It therefore
carries a `settledThroughKey` watermark: days strictly before that key have
already been accounted for, and the month-reset path must advance the
watermark too, or the forgiven gap is re-charged on the very next call.

(This was found by review, not by design — the original model tracked only
`lastCompletedKey`, which made the whole function non-idempotent.)

Stored in `localStorage` under `superclock-fitness-streak-v1`. Two further
requirements, both bugs this repo has hit before:

- **Local calendar dates, never `toISOString()`.** The UTC-vs-local trap is
  documented at [HabitsApp.tsx:22](../../../src/apps/habits/HabitsApp.tsx) —
  mixing them shifted day keys by one in any UTC+ timezone.
- **A day-rollover tick.** A kiosk left on this screen overnight otherwise
  keeps evaluating yesterday's date, exactly as `HabitsApp` had to fix.

## File layout

```
src/apps/fitness/
  index.ts            # registerApp — only the description copy changes
  FitnessApp.tsx      # shell: owns state, drives ticks, plays cues
  circuit.ts          # pure reducer
  circuit.test.ts
  circuit-store.ts    # module-level suspend/resume store, survives unmount
  circuit-store.test.ts
  exercises.ts        # the 12 exercises + workout definitions
  exercises.test.ts
  streak.ts           # hearts, localStorage, day rollover
  streak.test.ts
  useCircuitTimer.ts  # tick driver, gated on isActive
  audio.ts            # WebAudio beeps + preloaded voice clips
  WatchFace.tsx       # cream disc, ring, comet, number, hearts
  ExerciseArt.tsx     # the Spec A / Spec B seam

src/core/brightness-lease.ts   # new
scripts/gen-voice.sh           # new — offline voice-clip generation
```

## The Spec A / Spec B seam

`ExerciseArt` is the entire boundary between this spec and the animation
pipeline. Its prop signature is fixed now and does not change later:

```tsx
<ExerciseArt
  exerciseId="push-ups"
  phase="work" | "rest"   // 'rest' renders the neutral standing pose
  playing={boolean}       // false while paused — Spec B freezes the atlas
/>
```

`phase` is narrowed to the two values that change what is drawn, not the full
six-value `Phase` union: `countdown` hides the art entirely, and `ready` /
`paused` / `complete` reuse the neutral pose. Keeping the prop narrow means
Spec B does not have to reason about states that never reach it.

Spec A renders a single still image (the existing generated character).
Spec B swaps the internals to a sprite atlas. No caller changes, no app logic
touched. This is what makes splitting the specs pay off rather than merely
deferring work.

## Testing

- **`circuit.test.ts`** — a full 12-exercise circuit driven by synthetic
  timestamps; pause/resume preserves remaining time; skip on the final
  exercise completes rather than overruns; cues fire at exactly 3·2·1 and the
  next-exercise announcement lands in `rest`, not `work`; zero drift across a
  simulated 7 minutes.
- **`exercises.test.ts`** — exactly 12 entries in the pool; the `full-body`
  workout uses all 12 with no three consecutive exercises sharing a `target`
  value; every workout references only ids that exist in the pool; every id
  has a corresponding art asset and voice clip.
- **`streak.test.ts`** — a heart is lost on a missed day; month rollover
  restores three; local-date correctness across a UTC+ boundary.
- **`circuit-store.test.ts`** — suspend/take round-trips; take-once (a second
  take returns `null`); a mismatched workout id, a stale entry past
  `SUSPEND_TTL_MS`, and a `ready`/`complete` phase each return `null`;
  `clearSuspendedCircuit` works; pausing before suspending freezes
  `remainingMs` rather than letting wall-clock time leak in.
- **`registry-coherence.test.ts`** — unchanged and must stay passing. The app
  id is unchanged, so `ALL_KIOSK_APP_IDS`, `schema-registry.ts` and the
  registry test need no edits.

## Assets and deploy

- Art: `public/fitness/<exerciseId>.png`
- Voice: `public/fitness/voice/<exerciseId>.*`, generated by a committed
  `scripts/gen-voice.sh` using macOS `say` piped through `ffmpeg` (both
  verified available on the build machine).
- Approximate payload: 12 stills + ~20 clips ≈ 1–2 MB.
- **No `deploy.sh` change.** Vite copies `public/` into `dist/`, and the
  deploy script already ships `dist/`.

## Verification plan

A green build is not a working watchface. Before this is called done:

1. `npm run lint`, `npm test`, `npm run build` all pass.
2. The circuit runs end to end in the browser preview with correct timing.
3. Deployed to `superclock-fast` and verified on the physical device:
   audio is audible, the face is legible from across the room, rest inversion
   reads correctly, and the screen does not dim mid-workout inside the night
   window.
4. Left running for at least one full circuit with the app backgrounded
   partway through, confirming pause/resume and that no timer keeps ticking.

## Spec B preconditions (deferred — do not re-research)

Constraints established by research on 2026-07-24, recorded so the animation
pipeline spec starts from them rather than rediscovering them:

- **Mixamo licensing is clean and is the best available.** Adobe grants free,
  royalty-free, unlimited commercial use; the only prohibition is
  redistributing **raw** character/animation files. Rendered frames are a
  derivative work — the sanctioned use. No attribution required. Vendor the
  FBX files locally rather than hitting Mixamo at build time (its support
  status is uncertain and it has had multi-day auth outages).
- **Mixamo covers 6 of 12 exercises.** Present: push-ups, squats (`Air
  Squat`), plank, jumping jacks, burpees, sit-ups. **Absent: mountain
  climbers, lunges, wall sit, bench dips, and real high knees.** Wall sit and
  plank are near-static holds and trivial to hand-key; lunges and mountain
  climbers are the only two needing genuine animation work.
- **Render offline; do not run WebGL at runtime.** Every measured three.js
  figure on Pi 4 Chromium is single-digit fps, and on a Pi 5 with hardware
  acceleration confirmed a *blank* WebGL canvas still ran at 7–8 fps — a
  structural problem, not a workload one. A long-press on the touchscreen also
  synthesises a right-click, which is documented to kill the WebGL context.
  A permanently-animating canvas is also a permanent thermal load on a device
  that already throttles at 80 °C.
- **Sprite atlas, not animated WebP/GIF/APNG/video.** Chromium deliberately
  re-decodes animated images forever, caching only the previous frame.
  Animated WebP costs ~2.2× GIF's decode time for straight-line looping (the
  favourable 0.57× figure is the *seeking* benchmark, which does not apply).
  A sprite atlas decodes once at load and then costs nothing.
- **Animate `transform`, never `background-position`.** Only
  `transform`/`opacity`/`filter` are compositor-only; `background-position` is
  a paint property and forces main-thread work every step.
- **12 fps, 24 frames per 2-second cycle.** 12 fps is the documented
  perceptual floor for apparent motion and divides 60 evenly, so every frame
  gets equal screen time. 24 fps does not divide 60 and judders.
- **Render at 512×512, not 1080×1080.** The Pi's `GL_MAX_TEXTURE_SIZE` is
  4096 on both VideoCore VI and VII, so 1080px frames would fit only 9 per
  sheet. 24 frames at 512² packs into 3072×2048 (~24 MiB decoded).
- **AI image generation is not competitive for the animation.** It cannot
  produce true alpha, character consistency drifts across separate generation
  calls, models respond to identical start/end frames by generating little
  motion, and biomechanical accuracy on exercise-like poses is unreliable.
  It remains the right tool for designing the character as a **still** — which
  is how the current character was made.
- **Open question for Spec B:** whether to drive frames with a CSS
  `steps()` animation or an rAF-gated transform at exactly 12 Hz. A running
  CSS compositor animation ticks every vsync (60/s) even though the sprite
  changes 12 times/second; rAF-gating may cut compositing work substantially.
  This is inference, not measurement — settle it with a soak test on the
  device.

## Deferred

- Browsable exercise library (would need a data source again).
- 7-month challenge and pause-day banking.
- `superclock-square` (800×480) layout pass.
- `FLEET_SCHEMA_VERSION` v3 cleanup of dead `app.fitness` keys.
- Licence check or redraw of the comet glyph (`noun-comet-7706677`, sourced
  from the Noun Project) before it ships.
