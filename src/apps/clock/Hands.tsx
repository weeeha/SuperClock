import type { CSSProperties } from 'react';
import { CAST, SOFT, type HandShadowMode } from '../../shared/hand-shadow';

// Every face draws its hands in the same 1000-unit space about the same
// centre, as a vertical stroke rotated by useClockHands' angle. This is the
// one place that stroke is drawn, so the shadow option (agent log
// 2026-09-09) is one implementation and not five. The treatments' numbers
// (CAST, SOFT) live beside the option in src/shared/hand-shadow.ts.
const C = 500;

export interface HandSpec {
  /** Rotation in degrees from 12, from useClockHands. */
  deg: number;
  /** Length from the centre to the tip, in face units. */
  tip: number;
  /** Length past the centre on the far side. */
  tail?: number;
  width: number;
  stroke: string;
  /** A narrower stroke drawn on top: a bordered hand. The shadow follows the outer stroke only. */
  core?: { width: number; stroke: string };
  /** CSS transition for the rotation; the shadow gets the same one. */
  transition?: string;
}

interface HandsProps {
  /** Unique within the face's SVG; names the soft filter. */
  id: string;
  shadow: HandShadowMode;
  /** Drawn in order, the first at the bottom. */
  hands: HandSpec[];
}

function rotation(deg: number, transition?: string): CSSProperties {
  return { transform: `rotate(${deg}deg)`, transformOrigin: `${C}px ${C}px`, transition };
}

function Stroke({
  hand,
  width,
  stroke,
  className,
}: {
  hand: HandSpec;
  width: number;
  stroke?: string;
  className?: string;
}) {
  return (
    <line
      x1={C}
      y1={C + (hand.tail ?? 0)}
      x2={C}
      y2={C - hand.tip}
      stroke={stroke}
      strokeWidth={width}
      strokeLinecap="round"
      className={className}
      style={rotation(hand.deg, hand.transition)}
    />
  );
}

function Hand({ hand }: { hand: HandSpec }) {
  return (
    <>
      <Stroke hand={hand} width={hand.width} stroke={hand.stroke} />
      {hand.core && <Stroke hand={hand} width={hand.core.width} stroke={hand.core.stroke} />}
    </>
  );
}

export function Hands({ id, shadow, hands }: HandsProps) {
  if (shadow === 'cast') {
    // The offset sits on a group OUTSIDE the rotation, so the light stays
    // put while the hand turns. Interleaved with the hands so a hand's
    // shadow falls on the hands beneath it, not only on the dial.
    return (
      <>
        {hands.map((hand, i) => (
          <g key={i}>
            <g transform={`translate(${CAST.dx} ${CAST.dy})`} opacity={CAST.alpha} data-hand-shadow="cast">
              <Stroke hand={hand} width={hand.width} className="stroke-(--face-shadow)" />
            </g>
            <Hand hand={hand} />
          </g>
        ))}
      </>
    );
  }
  if (shadow === 'soft') {
    // One filter over all the hands, on a fixed full-face region. The
    // default region is a fraction of the element's own bounding box,
    // which for a thin hand at 3 o'clock is a few units tall and clips
    // the blur. One region rather than one per hand, because the whole
    // region re-rasterizes every frame the second hand moves; that cost
    // is why this mode is opt-in.
    const filterId = `${id}-hand-shadow`;
    return (
      <>
        <defs>
          <filter id={filterId} filterUnits="userSpaceOnUse" x={0} y={0} width={2 * C} height={2 * C}>
            <feDropShadow
              dx={SOFT.dx}
              dy={SOFT.dy}
              stdDeviation={SOFT.blur}
              floodOpacity={SOFT.alpha}
              style={{ floodColor: 'var(--face-shadow)' }}
            />
          </filter>
        </defs>
        <g filter={`url(#${filterId})`} data-hand-shadow="soft">
          {hands.map((hand, i) => (
            <Hand key={i} hand={hand} />
          ))}
        </g>
      </>
    );
  }
  return (
    <>
      {hands.map((hand, i) => (
        <Hand key={i} hand={hand} />
      ))}
    </>
  );
}
