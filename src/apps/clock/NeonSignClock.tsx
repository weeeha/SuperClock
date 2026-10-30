import { neonSignFaceSchema } from '../../shared/schemas/face.neon-sign';
import NeonCanvas from './neon/NeonCanvas';
import face from './neon/faces/sign';
import type { FaceProps } from './face-components';

/**
 * Neon Sign: a neon face drawn on a canvas (src/apps/clock/neon/faces/sign.ts,
 * hosted by NeonCanvas). The lit disc is content and stays dark in both
 * palettes, the way the Vinyl record does; the mat around it is --face-bg, so
 * the square device shows the palette in its corners and night reaches it
 * through the token flip.
 */
export default function NeonSignClock({ isActive, faceConfig }: FaceProps) {
  const parsed = neonSignFaceSchema.safeParse(faceConfig ?? {});
  const { glow } = parsed.success ? parsed.data : neonSignFaceSchema.parse({});
  return (
    <div className="theme-fade relative h-full w-full overflow-hidden bg-(--face-bg)">
      <NeonCanvas isActive={isActive} face={face} glow={glow} />
    </div>
  );
}
