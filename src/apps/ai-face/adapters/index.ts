import type { AvatarDesign, AvatarFamily } from '../../../shared/ai-face-designs';
import { abstractAdapter } from './abstract';
import type { FamilyAdapter } from './types';

export type { AvatarController, AvatarSample, FamilyAdapter } from './types';

const ADAPTERS: Record<AvatarFamily, FamilyAdapter> = {
  'core-eyes': abstractAdapter,
  'luminous-faces': abstractAdapter,
  'assistant-iris': abstractAdapter,
  'fractal-presence': abstractAdapter,
};

export function adapterFor(design: AvatarDesign): FamilyAdapter {
  return ADAPTERS[design.family];
}
