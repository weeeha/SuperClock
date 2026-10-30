import { z } from 'zod';
import type { FieldMetaMap } from '../types';

// Vinyl: a spinning record painted by a vendored Radiant shader
// (public/shaders/vinyl-grooves.html), hands and tonearm drawn over it.
export const vinylFaceSchema = z.object({
  // Platter speed. 33 is the default LP; 45 spins the groove shimmer faster.
  rpm: z.enum(['33', '45']).default('33'),
  // The groove sheen: prismatic diffraction (many hues) or a warm single-tone
  // sheen for a quieter dial.
  shimmer: z.enum(['prismatic', 'warm']).default('prismatic'),
});

export const vinylFaceMeta: FieldMetaMap = {
  rpm: { description: 'Platter speed: 33 for an LP, 45 for a single' },
  shimmer: { description: 'Groove sheen: prismatic diffraction colours, or a warm single-tone sheen' },
};

export type VinylFaceConfig = z.infer<typeof vinylFaceSchema>;
