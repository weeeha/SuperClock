// The entire boundary between this spec and the animation pipeline. The prop
// signature is fixed now and must not change: Spec B replaces the internals
// with a sprite atlas and no caller is touched.
//
// `phase` is deliberately narrower than the reducer's six-value Phase —
// countdown hides the art, and ready/paused/complete reuse the neutral pose,
// so only these two values change what is drawn.

interface ExerciseArtProps {
  exerciseId: string;
  phase: 'work' | 'rest';
  /** False while paused — Spec B freezes the atlas on the current frame. */
  playing: boolean;
}

export default function ExerciseArt({ exerciseId, phase, playing }: ExerciseArtProps) {
  const src = phase === 'rest' ? '/fitness/neutral.png' : `/fitness/${exerciseId}.png`;
  return (
    <img
      src={src}
      alt=""
      draggable={false}
      className="h-full w-full object-contain select-none"
      style={{ opacity: playing ? 1 : 0.45, transition: 'opacity 200ms ease' }}
    />
  );
}
