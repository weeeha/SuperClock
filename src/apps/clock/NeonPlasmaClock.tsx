import { neonPlasmaFaceSchema } from '../../shared/schemas/face.neon-plasma';
import NeonCanvas from './neon/NeonCanvas';
import face from './neon/faces/plasma';
import type { FaceProps } from './face-components';

/**
 * Neon Plasma: a neon face drawn on a canvas (src/apps/clock/neon/faces/plasma.ts,
 * hosted by NeonCanvas). The lit disc is content and stays dark in both
 * palettes, the way the Vinyl record does; the mat around it is --face-bg, so
 * the square device shows the palette in its corners and night reaches it
 * through the token flip.
 */
export default function NeonPlasmaClock({ isActive, faceConfig }: FaceProps) {
  const parsed = neonPlasmaFaceSchema.safeParse(faceConfig ?? {});
  const { glow } = parsed.success ? parsed.data : neonPlasmaFaceSchema.parse({});
  return (
    <div className="theme-fade relative h-full w-full overflow-hidden bg-(--face-bg)">
      <NeonCanvas isActive={isActive} face={face} glow={glow} />
    </div>
  );
}
