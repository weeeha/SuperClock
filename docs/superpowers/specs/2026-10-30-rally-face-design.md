# Rally face: design

2026-10-30. Brainstormed with Nick over five throwaway drafts (`.superpowers/brainstorm/87286-1793338535/content/`, last one `rally-3d-green.html`); he approved the look and said "let's make it a watchface".

## Intent

An endless, generated rally stage seen from above, in the toy-like low-poly style of the game art of rally, as the background of a clock face. It is ambient art you glance at: the car drives itself, the road never repeats, and the world, weather and light change on their own. The time sits on top.

## Decided by Nick

- A clock face with the time on top, not a separate app.
- Worlds are biome settings, not hand-built tracks per country: Africa, Desert road, Sand dunes (driving on sand, no asphalt), Snow forest, European city, Plains, Mountains, Iceland.
- Real low-poly 3D shapes and a tilted chase camera, "same level of style" as art of rally.
- Dust, rain, snow, and variety in light.
- Several car models.
- Mountains slower and calmer; green worlds greener, with grass.

## My calls (Nick can overrule)

- "Crossing lights" read as cloud shadows crossing the ground plus time of day.
- Light follows the real clock by default (morning 05-09, noon 09-17, sunset 17-20, night otherwise), and the kiosk's own night palette always forces the night scene, so night mode reaches the face through the same switch as every other face.
- On Auto: weather rerolls every 30 s from what that world allows, the car every 60 s from what suits the world, the world every 10 minutes.
- The car brakes into tight bends; mountains run at 0.6 of the base pace.
- Digital time, `HH:MM`, Inter bold, in `--sheet-ink` (a light ink that does not invert, because it sits on a scene rather than on `--face-bg`), with a soft shadow from `--face-shadow`. A `hour24` option like Flip's.
- Rendered at 30 fps and device pixel ratio 1, to keep a Pi cool on a kiosk that runs for weeks.

## Constraints from the repo

- Registered through `npm run new:face -- rally`; the schema is `face.rally`, read with `safeParse(faceConfig ?? {})`.
- Render loop and scene creation gate on `isActive`; time from `useClockHands`, no `setInterval`.
- The scene's colours are content (the world itself), so they live as data in `src/apps/clock/rally/`, outside the token gate's semantic zones; the face root paints `--face-bg` behind the canvas.
- Three.js (pinned 0.170.0) is a new dependency, loaded with a dynamic import so it ships as its own chunk and only downloads when the rally face is shown.
- One accent quantity: the car. The scene palette is content, like the neon faces' glow.

## Non-goals

- No player control, no lap times, no opponents.
- No LVGL version for the `slow` device.
- No per-country hand-made tracks.

## Open

- Pi 4 performance (small, square) is unmeasured; fastclock (Pi 5) is the first target. If a Pi 4 cannot hold 30 fps, the levers are shadows off, fewer props, fewer rain streaks.
- Railway or traffic crossing signals, if that is what "crossing lights" meant.
