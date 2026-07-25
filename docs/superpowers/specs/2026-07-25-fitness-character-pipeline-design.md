# Fitness — character animation pipeline

**Date:** 2026-07-25
**Status:** Design drafted, awaiting approval
**Scope:** Spec B of two. Spec A (`2026-07-24-fitness-workout-design.md`) shipped
and is deployed; this replaces its placeholder artwork.

## Goal

Replace the 13 identical placeholder stills in `public/fitness/` with a real
animated character — one consistent figure demonstrating each exercise, played
back as a sprite atlas at 12 fps.

Spec A left exactly one seam for this: `ExerciseArt.tsx`. Its prop signature
(`exerciseId`, `phase: 'work' | 'rest'`, `playing`) is fixed and does not
change. Everything in this spec happens behind it.

## Decisions

| Decision | Rationale |
| --- | --- |
| **Quaternius Ultimate Modular Men Pack** as the character | CC0 (public domain), FBX/OBJ/Blend/glTF, 11 characters. No licensing question, no attribution, redistributable in a public repo. |
| **Upload it to Mixamo's auto-rigger** rather than retargeting in Blender | Mixamo clips are bound to Mixamo's skeleton. Auto-rigging the Quaternius mesh means every clip downloads *already applied* to our character — no bone mapping, no retarget plugin, no deformation debugging. |
| **Rework the circuit to Mixamo-covered exercises** | Avoids hand-keying entirely. A full catalogue search found enough clips for a complete 12-exercise circuit with correct alternation (below) — better than the 6 the initial research suggested. |
| **Render offline; ship flat images** | Measured evidence rules out runtime WebGL: every three.js figure on Pi 4 Chromium is single-digit fps, and on a Pi 5 with hardware acceleration confirmed a *blank* WebGL canvas ran at 7–8 fps. See "Spec B preconditions" in Spec A. |
| **Sprite atlas, not animated WebP/GIF** | Chromium re-decodes animated images forever, caching only the previous frame. Animated WebP costs ~2.2× GIF's decode time for straight-line looping. An atlas decodes once and then costs nothing. |

### The character is no longer the Figma character

Spec A's placeholder is Nick's ChatGPT-generated chunky 3D figure, and the
Figma watchface was designed around it. **This spec abandons that likeness**
in favour of a CC0 model that rigs and animates reliably.

That is a deliberate trade: a consistent animated figure that is *not* the
Figma character beats a perfect still that never moves. If the Quaternius
character reads badly on the wall, the fallback is image-to-3D from the
original render — more fidelity, materially more risk (auto-rigging a
big-headed stylised figure deforms badly, and it is a paid service).

## The reworked circuit

`exercises.ts` is rewritten. All twelve clips are confirmed present in the
Mixamo catalogue (verified against a 2,382-name index), and the
upper → lower → core alternation Spec A pins in `exercises.test.ts` still holds.

| # | Exercise id | Name | Mixamo clip | Target |
| --- | --- | --- | --- | --- |
| 1 | `push-ups` | Push-ups | `Push Up` | upper |
| 2 | `squats` | Squats | `Air Squat` | lower |
| 3 | `sit-ups` | Sit-ups | `Situps` | core |
| 4 | `front-raises` | Front Raises | `Front Raises` | upper |
| 5 | `jumping-jacks` | Jumping Jacks | `Jumping Jacks` | lower |
| 6 | `plank` | Plank | `Plank` | core |
| 7 | `arm-stretch` | Arm Stretch | `Arm Stretching` | upper |
| 8 | `cross-jumps` | Cross Jumps | `Cross Jumps` | lower |
| 9 | `bicycle-crunch` | Bicycle Crunch | `Bicycle Crunch` | core |
| 10 | `jump-push-ups` | Jump Push-ups | `Jump Push Up` | upper |
| 11 | `burpees` | Burpees | `Burpee` | lower |
| 12 | `circle-crunch` | Circle Crunch | `Circle Crunch` | core |

**Exercises leaving the circuit:** bench-dips, lunges, mountain-climbers,
high-knees, shoulder-taps, side-plank, crunches. Their voice clips and
placeholder art are deleted.

**Honest note on this trade.** Letting the tool dictate the workout is a real
cost, and lunges in particular are a staple worth missing. `Front Raises` and
`Arm Stretching` are also weaker "exercises" than what they replace — the
former is normally weighted, the latter is closer to active recovery. If the
circuit feels thin in use, the fix is to hand-key the missing moves after all;
that decision is deferred, not foreclosed.

## Pipeline

### Stage 1 — character and clips (MANUAL, one-off)

**Mixamo has no API.** This stage is a manual web session and cannot be
scripted. Whoever runs it should expect to sit in a browser for it.

1. Download a character from Quaternius Ultimate Modular Men Pack (CC0), FBX.
2. Upload the FBX to Mixamo's auto-rigger; accept the generated rig.
3. Download each of the twelve clips above **with "In Place" ticked**. Mixamo
   clips have no root bone — translation is baked onto `mixamorig:Hips`, so a
   clip downloaded without "In Place" walks out of frame.
4. Vendor the FBX files into `assets/mixamo/` (gitignored — see Licensing).

Mixamo's support status is uncertain (multi-day auth outages in 2025; one
Adobe rep called it unsupported). **Download once and keep the files locally**;
do not build a pipeline that hits Mixamo at build time.

### Stage 2 — render (scripted)

`scripts/render-exercises.py`, run headless via Blender 5.1.1 (verified
present at `/Applications/Blender.app/Contents/MacOS/Blender`, Python 3.13.9).

Per clip: import FBX, apply the shared camera/light/material setup from a
committed `template.blend`, render 24 frames to PNG with alpha.

Settings that are load-bearing — each is a documented failure mode:

- **Transparency needs two things**: Render → Film → Transparent **and**
  Output → Color = **RGBA**. Missing the second yields a black background that
  looked transparent in the viewport.
- **Colour management → View Transform = `Standard`.** Blender 4.0+ defaults to
  **AgX**, which desaturates and rolls off toward white; authored flat colours
  will not round-trip.
- **EEVEE, not Cycles.** Tens of ms/frame and no sampling noise — noise also
  wrecks atlas compression.
- **Orthographic camera with one fleet-wide `ortho_scale`**, computed from the
  union bounding box across *all* frames of *all* clips. Otherwise jumping-jack
  arms clip while the plank sits tiny, and a squat moving toward camera changes
  apparent size.
- **Mixamo FBX import**: armature arrives at scale 0.01 (Transform → Apply
  Scalings = "FBX All"), Manual Orientation **-Z Forward / Y Up**, enable
  *Ignore Leaf Bones* and *Automatic Bone Orientation*. Discard Mixamo's
  materials and assign our own flat/toon material.
- **Seamless loop**: Mixamo's cyclic clips duplicate the first pose as the final
  keyframe. Render `1..N` where frame `N+1` equals frame `1` — **trim one
  frame** or there is a visible hitch every cycle. Verify by byte-comparing the
  two rendered PNGs.
- Blender's `WEBP` output "may not be compiled in on all systems" — use PNG and
  convert afterwards.

### Stage 3 — atlas packing (scripted)

`scripts/pack-atlas.py` (Pillow, already available).

- **24 frames per exercise** — a 2-second cycle at 12 fps.
- **512×512 per frame**, never 1080. The Pi's `GL_MAX_TEXTURE_SIZE` is 4096 on
  both VideoCore VI and VII, so 1080px frames fit only 9 per sheet. 24 frames at
  512² packs into 3072×2048 ≈ 24 MiB decoded.
- One atlas per exercise, `public/fitness/atlas/<id>.webp`, plus a small
  `manifest.json` (frame count, grid dimensions, frame size).
- Load one atlas at a time and drop the previous, so decoded memory stays flat
  over weeks.

**Why 12 fps:** it is the documented perceptual floor for apparent motion
(10–12 images/sec), it is the traditional "on twos" convention, and it divides
60 evenly so every frame gets identical screen time. 24 fps does **not** divide
60 and judders on a 60 Hz panel. If more is ever needed, go to 15 or 20.

### Stage 4 — playback

`ExerciseArt.tsx` internals only. Renders the atlas as a background and steps
`transform` — **never `background-position`**, which is a paint property and
forces main-thread work every step. Only `transform`/`opacity`/`filter` are
compositor-only.

**Open question to settle by measurement, not argument:** CSS `steps(24)` on
`transform` versus an rAF-gated transform at exactly 12 Hz. A running CSS
compositor animation ticks every vsync (60/s) even though the sprite changes 12
times a second; rAF-gating should cut compositing work ~5×. That is inference,
not a citation — settle it with a soak test on the device measuring steady-state
CPU and `vcgencmd measure_temp` over 30 minutes.

`playing={false}` (paused) must freeze on the current frame, not dim it — Spec
A's opacity treatment was a placeholder for exactly this.

## Licensing

- **Quaternius: CC0.** No attribution required, redistributable.
- **Mixamo:** Adobe grants free, royalty-free, unlimited commercial use. The
  only prohibition is redistributing **raw** character/animation files. Rendered
  frames are a derivative work — the sanctioned use. No attribution required.
- **Therefore:** rendered atlases are committed to the public repo; the source
  FBX files are **not**. `assets/mixamo/` and `assets/quaternius/` go in
  `.gitignore`, with a README explaining how to re-obtain them.

## Testing

- `exercises.test.ts` — unchanged assertions, new ids. The asset-coherence test
  added in Spec A already fails CI if an exercise lacks art, and must be
  extended to check the atlas + manifest instead of a flat PNG.
- `atlas-manifest.test.ts` (new) — every manifest's frame count matches the
  atlas dimensions; every exercise id has a manifest entry.
- A render-output check: assert the first and last frames of each clip are
  **not** byte-identical (that would mean the duplicate-final-frame trim was
  missed and the loop hitches).

## Verification

1. `npm run lint`, `npm test`, `npm run build` clean.
2. Every exercise animates in the browser preview. Note the Spec A finding: the
   preview tab is permanently backgrounded and rAF is suppressed there, so use
   the dev-only `window.__fitness` handle to step phases.
3. On `superclock-fast`: a full circuit, checking each animation reads
   correctly at arm's length and across the room.
4. **A 30-minute soak** with a workout looping, recording steady-state CPU and
   `vcgencmd measure_temp` / `get_throttled`. The Pi's soft throttle is 80 °C
   and a passive heatsink reaches it after ~200 s of sustained load. This is the
   measurement that decides CSS-`steps()` versus rAF-gating.

## Deferred

- Hand-keying lunges / mountain climbers / wall sit / bench dips / high knees to
  restore them to the circuit.
- Image-to-3D from the original ChatGPT character, if the Quaternius figure
  reads badly.
- `superclock-square` (800×480) — atlases are resolution-independent, but the
  frame size may want revisiting for a smaller panel.
