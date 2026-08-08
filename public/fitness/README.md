# Fitness app artwork

`push-ups.png` is the real character — Nick's generated 3D figure, pulled from
Figma (`Clock-Design-WIP`, node 681:25977), background knocked out and
normalised to 512×512 RGBA.

**Every other file in this directory is a copy of it, standing in as a
placeholder.** They are deliberately wrong: the app will show a push-up pose
during squats and during rest. This is Spec A shipping with one pose so the
circuit runner can be built and verified; Spec B (the Mixamo → Blender →
sprite-atlas pipeline) replaces all of them with per-exercise animation.

`ExerciseArt.tsx` is the seam — its prop signature is fixed so swapping these
for atlases touches no caller.

Do not treat the duplicated files as intentional artwork.
