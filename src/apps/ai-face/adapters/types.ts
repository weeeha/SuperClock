import type { AvatarActivity, AvatarDesign, AvatarExpression } from '../../../shared/ai-face-designs';
import type { AvatarState } from '../sources/types';

/** frame: the page's own rendered-frame counter. idle: the page is not trying
 *  to animate (paused, reduced motion), so a stalled counter is not slowness. */
export interface AvatarSample {
  frame: number;
  idle: boolean;
}

export interface AvatarController {
  apply(state: AvatarState): void;
  setPaused(paused: boolean): void;
  setMuted(muted: boolean): void;
  sample(): AvatarSample;
  destroy(): void;
}

// One per AI-Avatars family. Maps the canonical vocabulary onto the family's
// own and drives the page through its window API, never through its DOM
// controls. A runtime package can replace the iframe later behind this shape.
export interface FamilyAdapter {
  pageUrl(design: AvatarDesign): string;
  kioskCss: string;
  activityMap: Record<AvatarActivity, string>;
  expressionMap: Record<AvatarExpression, string>;
  /** null until the page API is ready and showing the requested character. */
  attach(win: Window, design: AvatarDesign): AvatarController | null;
}
