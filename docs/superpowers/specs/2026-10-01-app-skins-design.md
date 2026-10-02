# App skins: design

**Date:** 2026-10-01
**Status:** Draft, waiting on Nick's review
**Owner:** Nick
**Figma:** [SupeClock-Design, page "Apps v2 · skins"](https://www.figma.com/design/7riwsUFkbksAeYqcNQD5AQ/SupeClock-Design?node-id=9-2) (personal account). 45 frames: 15 apps x 3 skins, dark only. Snapshots in `docs/design/2026-10-01-apps-v2-skins-{left,right}.png`.

**TL;DR.** Every kiosk app gets three looks: Chronograph, Dot matrix and Poster. A clock picks one with a new optional `settings.skin`. Apps stop owning their main screen's look: each app produces one small data object (the glance), and three skin renderers draw it. Ambient apps (Breathing, Fireplace, Photo frame) supply their own per-skin scene instead. Detail and interactive views stay one shared design. An unset `skin` keeps today's look, so the work ships app by app.

## Problem

The apps were designed one at a time as grey wireframes and built one at a time, so they share no visual language and read as "meh" on the panels. Three directions were drawn this session (round 1 on page "Apps v2 · directions", round 2 on "Apps v2 · skins"). Nick liked all three and asked for them as skins rather than picking one.

## Users and job

- **Primary:** Nick, glancing at a clock from across a room. The job: "tell me the one thing this screen is for, in a look I chose for this room."
- **Secondary:** Nick in the admin, choosing a skin per clock (the fleet-first admin already gives each clock its own control room).

## Approach

**One glance model per app, three renderers.** Drawing all 45 frames showed that every non-ambient app reduces to the same parts: one dominant value, a label, one sentence, a secondary line, a rim series, a progress fraction, an optional short list and a status. An app computes that object from its data. `<GlanceView skin={…}>` draws it in the chosen skin. That makes skins one renderer per skin, not 45 hand-built components, and a new app gets all three looks by filling the model.

**Ambient apps are scenes, not glances.** Breathing, Fireplace and Photo frame have no "value"; the animation is the app. Each supplies a small `scenes` map, one component per skin (dot flames, layered poster flames, heat bars), and keeps its own `isActive`-gated animation.

**Detail views are shared.** Agents chat and avatar, the Todo add keyboard, Calendar month, week, year and details, Claude's detail view, the Time tracking task picker, and the Habits detail stay one design in today's style. Skinning interactive surfaces triples the hardest work for the least-seen screens.

### Alternatives considered

| Option | Tradeoff | Why not |
|---|---|---|
| Pick one direction | Least build | Nick wants all three |
| Three hand-built components per app | Full freedom per frame | 45 components that drift apart; every new app needs three |
| Skins as CSS themes over one layout | Cheapest | The skins differ in structure (a dial, a dot grid, a cropped poster), not in colour, so CSS alone cannot express them |

## The glance model

```ts
type Glance = {
  status: 'live' | 'stale' | 'offline' | 'empty' | 'unconfigured' | 'loading';
  value: string;                         // "14°", "12:47", "3/5", "62%"
  valueSplit?: [string, string];         // stacked form: ["12", "47"] for min over sec
  label?: string;                        // "Cloudy", "Focus", "Squats"
  sentence?: string;                     // "Rain from 15:00." One line, plain words
  secondary?: string;                    // "H 16°  L 8°"
  progress?: number;                     // 0..1, the one accent quantity on the rim
  series?: {
    kind: 'hours24' | 'hours12' | 'days' | 'weeks' | 'segments';
    values: number[];                    // normalised 0..1
    highlight?: number;                  // index lit in the accent (now, today)
    spans?: { from: number; to: number; tone: 'ink' | 'muted' | 'accent' }[]; // events, blocks
  };
  list?: { text: string; state: 'open' | 'done' | 'active' | 'waiting' }[]; // 5 rows max
};
```

Which apps fill which fields:

| App | value | sentence / label | progress | series | list |
|---|---|---|---|---|---|
| Weather (each of its pages) | temp, %, km/h, UV | condition, next change | | hours24 values | |
| Timer | split min / sec | task | time left | | |
| Habits | done / total | what is left | | days (30) | habits |
| Calendar | next start | next title, "in 1 h 30" | | hours12 spans | |
| Countdown | days | "days to …", date | span elapsed | | |
| Claude usage | session % | reset time, week % | session | | |
| GitHub | today count | year total, streak | | weeks (52) | |
| Time tracking | elapsed | task, today total | | hours12 spans | |
| Fitness | seconds left | exercise, next | interval | segments (rounds x exercises) | |
| Agents | count needing you | | | | agents |
| Todo | count left | | | segments | items |
| Quote | | the quote, author, source | | | |

Scenes: Breathing, Fireplace, Photo frame. Clock is not part of this: faces remain their own system.

## Key design decisions

| # | Decision | Why |
|---|---|---|
| 1 | `settings.skin: z.enum(['chronograph','dotmatrix','poster']).optional()`; unset means today's look | Patches replace the whole `settings` object, so a required field would break stored configs and older admin clients. An optional field is a minor change to the schema snapshot, so `FLEET_SCHEMA_VERSION` does not move. Unset also lets the work ship one app at a time |
| 2 | One skin per device, not per screen instance | It matches "a look I chose for this room"; per-instance overrides can be added later without a breaking change |
| 3 | An app without a renderer for the active skin falls back to today's look | Honest partial rollout; the admin lists which apps cover which skin |
| 4 | One accent quantity per screen in every skin, including Poster | Keeps the one-accent rule's intent. Poster's coloured fields are surfaces with their own night values, not a second accent |
| 5 | Dot matrix draws its grid into one `<canvas>` per screen, redrawn on state change only | About 1 450 dots per screen; 1 450 DOM nodes per app is real cost on a Pi 4, and the grid never animates except in ambient scenes |
| 6 | Dot numerals use a 5x7 bitmap font scaled x2 or x3; labels stay Inter | Nothing OS pairs a dot display face with a plain sans the same way; a full dot alphabet does not fit the disc at a readable size |
| 7 | Every `status` other than `live` has a designed tell in each skin | The honest-offline rule. Fallback or sample data rendered as live is a bug in any skin |

## Constraints

- **Viewport:** 1080 round. Nothing that carries meaning outside the disc; the arc gesture zones stay clear.
- **Type:** Inter only. Skin type sizes have to land on the font-size ratchet (`CEILINGS.fontSizes`, 54). Poster's 300 to 780 px numerals are new steps.
- **Colour:** tier-2 roles and the `--face-*` set only. Poster needs new per-app field roles (see open questions).
- **Night:** Chronograph and Dot matrix are dark-native and flip through `--face-*`. Poster fields each need a night value.
- **Timers:** gate every timer and rAF on `isActive` (`KIO-1`). Glance renderers are static between data changes.
- **Out of fleet:** slowclock runs native LVGL and is out of scope.

## Success criteria

- Changing the skin in the admin restyles every covered app on that clock within one config poll (5 s), with no reload.
- Each skin passes 4.5:1 for text on its real surface, in day and in night (`token-contrast.test.ts` extended to the skin roles).
- Each skin has a designed tell for offline, stale, empty and unconfigured, and the tell renders on glass.
- A new app scaffolded by `npm run new:app` gets all three looks by filling `Glance`; the scaffolder emits the glance stub.
- No covered app runs a timer while inactive, and the dot grid does not repaint between data changes.

## Out of scope

- Skinning detail and interactive views.
- Clock faces, and a "skin" for faces.
- Per-instance skin overrides.
- slowclock (LVGL).
- Admin restyling.

## Open questions

1. **Which skin ships first?** Recommendation: Dot matrix, because it's the most distinct and the cheapest to render. Nick decides.
2. **Day palettes.** All 45 frames are dark. Each skin needs a day version, or a decision that a skin is dark-only.
3. **Poster colour roles.** Weather sky, Countdown navy, Time tracking dusk, the cream fields: new tier-2 roles (`--field-*`), each with a night value, or a smaller shared set. A design call.
4. **Poster Weather gradient.** It is data (sky colour by hour and condition), but unslop bans gradients. Needs an explicit, recorded exception or a flat fallback.
5. **Font-size ratchet.** Poster adds roughly six new size steps. Either the skin scale is declared once and counted as one, or the ceiling moves by decision.
6. **Non-happy states.** Not drawn for any skin. They should be drawn before a renderer is called done (decision 7).
7. **Weather's six pages.** Each page is a glance with a different `series`. Does Poster really need six Weather posters, or does Poster show only Now?
8. **Fourth skin, Signal colour: Nick chose variant B, Widget fields (2026-10-02).** Section `38:2`: all 15 apps, day row and night row. Rules as drawn:
   - **Hue = kind of app, nothing else.** The whole disc is the category hue; same hue means same kind: Weather blue; Calendar red; Countdown pink (your dates); Timer and Time tracking orange (running time); Habits and Fitness lime (movement); Claude usage and Agents violet (AI); GitHub green (code); Breathing cyan; Todo yellow (lists); Quote paper `#EFEBE0` (nothing to signal); Fireplace orange with black flames; Photo frame uses the photo as its field with a black capsule for chrome.
   - **Ink is always black** (white fails 2.0 to 3.2:1 on every field). Two derived shades only: panel = hue x 0.84, track = hue x 0.66. State is fill versus outline versus 32% black, plus one Fraunces SemiBold Italic word.
   - **Anatomy:** 76 px black icon tile (glyph in the hue) + Fraunces 44 title at y 130; Nunito ExtraBold 280 value at y 214; Fraunces 44 sentence at y 572; Nunito Bold 38 detail at y 634; then either a 660 x 210 panel (r 52, ends y 914) or a rim ring (r 488, 34 px, round caps).
   - **Night:** the field goes black, black ink becomes the hue at 90% (70% fails 4.5:1 for blue on black; 85% fails against the night panel at 4.3:1), panels the hue at 14%, tracks at 24%, glyphs flip to black on a hue tile. Photo dims to 45%. Night is the kiosk's existing `html.dark`, so a clock with theme Dark shows the night recipe all day.
   - **States** (section `54:2`, 26 frames): stale = last value dimmed with an outline "Offline since" chip; no data = a lucide glyph in the value slot; alert = the inverse black chip with hue text (approved 2026-10-02); done = plain words. Stale dims to 70% in code (60% drawn): 60% of the night ink falls under 3:1.
   - **Shipped (2026-10-02, `6c3edfc`, on fastclock):** `settings.skin: 'fields'` (`src/shared/skins.ts`), Weather's Now page only (`src/apps/weather/FieldsWeather.tsx`), four `--fields-weather*` roles in `tokens.css`, Fraunces and Nunito bundled via `@fontsource-variable`, admin Settings "App skin" row. Other Weather pages and other apps keep Classic.
   - **Still open:** the alert. Red is Calendar's category, so "urgent" cannot be red. Proposed: an inverse black chip with hue ink (as Todo's "yesterday" chip), never a hue. Also: lime and orange fields may be too bright on the panels by day; check on glass. Fraunces and Nunito need a recorded exception to the Inter-only rule. Variants A (`28:2`) and C (`38:15`) stay on the page as the alternatives considered.
9. **Fallback signal.** When an app has no renderer for the active skin, should the admin say so on the skin picker, or is the mismatch silent on glass?

## Handoff pointers

- Frames: rows `9:3` (Chronograph), `9:12` (Dot matrix), `9:21` (Poster); columns Weather, Timer, Habits, then `18:2` to `18:72` in the order of the table above.
- Rendering kits used in the drafts (tick placement by rotation matrix, arc bands, the 5x7 font, the dot grid at 24 px pitch with 15 px dots and radius 516) are the reference geometry for the renderers.
- Touchpoints when built: `src/shared/device-config-schema.ts`, `src/core/apply-settings.ts` (skin context next to theme and accent), `src/shared/types.ts` (`AppProps` gains the active skin), the admin settings form, `scripts/new-app.mjs`, `docs/health.md` (a skin-coverage column).

## Changelog

- 2026-10-01: first draft, from the three-direction rounds and the 45-frame skins grid.
- 2026-10-02: fourth skin (Signal colour) explored as variants A, B and C; Nick chose B; all 15 apps drawn day and night, 26 states drawn, Weather Now shipped behind settings.skin.
