import type { ReactNode } from 'react';
import type { HandShadowMode } from '../../shared/schemas/hand-shadow';

/** Offset of the cast shadow in the 1000-unit face space. Applied OUTSIDE the
 *  hand's own rotation on purpose: the light stays fixed while the hand turns,
 *  where rotating the offset with the hand would light every hour from a new
 *  sun. */
const CAST_OFFSET = { x: 8, y: 10 } as const;

const SOFT_FILTER_ID = 'face-soft-shadow';

/** feDropShadow for `soft`. Re-rasterises a blurred region every frame, which
 *  is why it is opt-in and why no face defaults to it. */
export function SoftShadowFilter() {
  return (
    <filter id={SOFT_FILTER_ID} x="-20%" y="-20%" width="140%" height="140%">
      {/* flood-color is set through style, not the presentation attribute:
          var() does not resolve in a presentation attribute, so the
          attribute form rendered a filter that painted nothing. The alpha
          rides in the token (0.38 light, transparent dark), hence opacity 1. */}
      <feDropShadow dx="5" dy="7" stdDeviation="9" style={{ floodColor: 'var(--face-shadow-soft)', floodOpacity: 1 }} />
    </filter>
  );
}

interface Props {
  mode: HandShadowMode;
  /** Colour the real hands paint in; children stroke with currentColor. */
  color: string;
  children: ReactNode;
}

/** Draws its children twice for `cast`: once offset in --face-shadow, once in
 *  `color`. Children MUST stroke and fill with currentColor, which is how one
 *  copy becomes a shadow without every face restating its geometry.
 *
 *  --face-shadow is transparent in dark mode, so the offset copy costs one
 *  draw call and paints nothing at night. That is deliberate: a black shadow
 *  on a black dial is invisible either way, and stating it in the token means
 *  a face never has to special-case the palette. */
export default function HandShadow({ mode, color, children }: Props) {
  return (
    <>
      {mode === 'cast' && (
        <g
          className="theme-fade"
          transform={`translate(${CAST_OFFSET.x} ${CAST_OFFSET.y})`}
          style={{ color: 'var(--face-shadow)' }}
          aria-hidden
        >
          {children}
        </g>
      )}
      <g className="theme-fade" style={{ color }} filter={mode === 'soft' ? `url(#${SOFT_FILTER_ID})` : undefined}>
        {children}
      </g>
    </>
  );
}
