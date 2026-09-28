import { z } from 'zod';
import type { FieldMeta } from './types';

// The hand-shadow option a face may carry, decided 2026-09-09 (agent log,
// "hand shadows"). An enum and not a boolean, because the fleet spans one
// Pi 5 and three Pi 4s and the two treatments cost differently:
//   none  draws nothing.
//   cast  is an offset copy of each hand, flat black at alpha 0.32. One
//         extra element per hand, nothing per frame. Every device.
//   soft  is a blurred drop shadow that re-rasterizes every frame while
//         the second hand sweeps. Opt-in, fastclock only.
// A face gains the key only with a decided default; the decisions are the
// table in src/shared/hand-shadow.test.ts. Drawn by src/apps/clock/Hands.tsx.
export const HAND_SHADOW_MODES = ['none', 'cast', 'soft'] as const;
export type HandShadowMode = (typeof HAND_SHADOW_MODES)[number];
export const handShadowSchema = z.enum(HAND_SHADOW_MODES);

export const handShadowMeta: FieldMeta = {
  description:
    'Shadow the hands cast on the dial. "cast" is a flat offset copy and costs nothing per frame. "soft" is a blurred drop shadow that re-renders every frame, so it belongs on the Pi 5 only.',
};

// The two treatments' numbers, from the same decision (Figma, Clock Design
// WIP, Sheet 03, node 705:4080). Offsets are in the 1000-unit face space.
// They live here and not beside the component because a component file may
// export only components (react-refresh), and because they are the record.
export const CAST = { dx: 8, dy: 10, alpha: 0.32 } as const;
export const SOFT = { dx: 5, dy: 7, blur: 9, alpha: 0.38 } as const;

/** The second hand's spring, shared so a hand and its shadow move as one. */
export const SECOND_HAND_SPRING = 'transform 0.2s cubic-bezier(0.4, 2.08, 0.55, 0.44)';
