# Watchface archetypes — structural study

**Date:** 2026-07-24
**Status:** Exploration. No face design is approved and no implementation is planned yet.
**Scope:** Structure only — how information is arranged on a dial. Palette, type and motion
are deliberately out of scope until a direction is picked.

## Why this exists

A face-design session started from a mood board of ~19 reference watchfaces. Copying any of
them is not the goal, so the references were first reduced to **structural skeletons** —
layout rules with the styling stripped out — and then widened with research into four
traditions the mood board did not sample.

The output is two drawn sheets plus the findings below.

| Sheet | Contents |
|---|---|
| [Sheet 01 — Dial archetypes](2026-07-24-watchface-archetypes/sheet-01-archetypes.html) | The mood board reduced to 9 structures (plates 01–09) |
| [Sheet 02 — The wider field](2026-07-24-watchface-archetypes/sheet-02-wider-field.html) | ~100 structures from 4 traditions → 8 encoding families, 9 more plates (10–18) |

Open either file in a browser. Both are self-contained and theme-aware.

## The finding that reframed the exercise

**Every face we ship encodes time as angle.** All nine shipped faces, and all nine plates on
Sheet 01, use a rotating pointer or a digit readout. Research turned up eight distinct
encoding families; we occupy one of them.

| Family | What varies | Reads at 3 m | Needs a learned code |
|---|---|---|---|
| Angle | Rotation of a pointer about a pivot | Depends on hand mass | No |
| Aperture | Which part of a hidden disc is visible | Best in class | No |
| Length & area | How much of a bar, arc or disc is filled | Yes | No |
| Count | Number of discrete cells switched on | Optically yes | Yes |
| Colour | Chromaticity of a field, no marks at all | Yes, coarsely | Yes |
| Language | Which words are lit | Only if few words | No |
| Lattice | Position of a marker in a fixed matrix | Marker yes, cells no | No |
| Composed form | An emergent shape assembled from non-clock parts | Yes, full-canvas | No |

Several non-angle families get *more* legible with distance, not less — the opposite of how
subdials behave.

## Hard constraints established

### Viewing distance sets a type budget

`superclock-fast/device.json` confirms a **Waveshare 5″ 1080×1080 round** panel. A 5″ round
panel is 127 mm across, so **8.5 px/mm**. Comfortable glance-reading at 3 m needs roughly
15 arcmin of cap height ≈ 13 mm ≈ **120 px, or 11% of the dial diameter**.

That allows about four large digits, or an analog dial whose hands reach 0.8R. Anything under
~40 px is decoration, not information. This is a wall clock, not a wristwatch, and most
smartwatch layouts assume a 30 cm reading distance.

### We have no biometric sensors

Nearly every reference dial devotes subdials to heart rate, steps or calories. We have none of
those. `app.fitness` is a **manual rep counter**, not a wearable, and the only complications
that exist are `complication.date` and `complication.temperature`.

Available data: time, date, calendar events (ICS), weather and temperature, GitHub
contributions, Claude usage, habits, todos, photos. Any borrowed subdial layout needs a
different payload — see plate 01 on Sheet 01, which repurposes the three counters as
time-domain rather than body-domain.

### Existing coverage

Nine faces ship today: Minimalismo, Analog, Productivity, Square, Floral, Complications
Light, Complications Dark, World, Flip. Plates tagged *adjacent* on either sheet overlap one
of these and would need a clear differentiator to be worth building.

## Findings from platform research

### Three platforms agree on a lit-pixel budget; our night mode does not meet it

Wear OS quality rule **WO-P7** and Samsung's Watch Face Studio both cap always-on faces at
**15% of pixels lit**, averaged across the face and sampled every ten minutes across a whole
day. Garmin is stricter at 10% and shuts the screen off above it.

Our night mode dims via CSS, which lowers brightness but leaves the same pixels lit. A face
built to a real pixel budget looks structurally different: thin strokes, no filled areas, and
a small per-minute position shift for burn-in. This is a separate piece of work from face
design and is not addressed by this study.

Sources: `developer.android.com/docs/quality-guidelines/wear-app-quality`,
`developer.samsung.com/watch-face-studio/user-guide/always-on.html`

### No platform publishes a watch-face taxonomy

Apple names ~62 faces and groups them zero ways; its only official taxonomy is complication
families. Wear OS has no layout types. Pebble shipped watchfaces as a single flat bucket.
Facer's live categories are genres (Anime, Luxury, Space) with no Analog/Digital split.

The only portable structural vocabulary anywhere is the slot system: **corner, bezel,
edge-arc, subdial, background, inline band**.

Our `classic | modern | data-rich | artistic | utility` categories in
`src/shared/face-registry.ts` are our own invention. That is fine, but they should be named
for what our faces do rather than presented as an industry standard.

### Apple's gauge trichotomy is worth adopting

- **Closed gauge** — a ring completing 360°, value as a fraction of a whole
- **Open gauge** — an arc with visible endpoints, value between an arbitrary min and max
- **Segmented gauge** — a divided arc, for values that change rapidly

A real information-design distinction we currently make by accident. Maps directly onto the
rim-gauge plate (Sheet 01, plate 02).

Source: `developer.apple.com/design/human-interface-guidelines/complications`

### Motion is a distance cue that geometry is not

The Mondaine station clock's second hand sweeps in **58.5 s**, then parks at twelve for a beat
until the master impulse steps the minute — the minute is read from the pause, not from a
mark. Deadbeat seconds work similarly: sixty discrete 6° positions read further away than any
printed graduation.

`useClockHands` already exposes a `sweep` option, so this costs a decision rather than code.

### Pebble published the only round-specific layout rules

- Keep information at least two pixels off the bezel.
- Avoid thin rings near the edge — mounting tolerance makes them visibly off-centre.
- Paginate rather than reflow: every text row in a circle has a different available width.

All three apply to a round panel in a printed housing. The thin-ring warning is the one our
existing faces are most likely to trip.

Source: `developer.rebble.io/guides/design-and-interaction/in-the-round`

## Open decisions

Nothing below is settled. These block moving from study to design.

1. **Which plates do we develop?** Current recommendation is one face from each of three
   different families rather than three angle-faces: plate 13 (Depletion disc), plate 11
   (Aperture plate), plate 12 (Daylight band). Plate 17 (Composed strokes) if a fourth with
   more personality is wanted.
2. **How many faces ship?** Every face shared with the `slow` device needs a second,
   hand-maintained LVGL implementation in `slow-native/src/clock_face.c`. Two faces done
   properly is likely better than five half-built.
3. **May a face require learning?** Plates 14 (Count register) and 16 (Colour sector) are
   unreadable to a guest until explained. Legitimate for a clock in your own home; a poor
   choice for anything shared.
4. **One family or standalone pieces?** A shared palette and hand geometry would make the set
   read as SuperClock rather than as unrelated downloads.

## Reference

Research covered mechanical horology (25 dial layouts), smartwatch platform documentation
(Apple, Wear OS, Samsung, Garmin, Pebble, Facer), industrial and graphic clock design
(29 traditions, Braun through Berlin-Uhr), and experimental/ambient time display
(29 concepts, calm technology through ClockClock 24). Per-entry sources are cited inline in
the research; the two sheets carry the distilled attributions.
