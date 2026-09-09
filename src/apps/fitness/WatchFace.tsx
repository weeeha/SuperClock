// The Figma watchface (Clock-Design-WIP, node 681:25972): cream disc, red →
// orange progress ring with a comet at the leading tip, large dark number,
// hearts. Rest inverts the disc to dark — this palette is already red/orange
// so a hue flip has nowhere to go, and inverting lightness gives the same
// across-the-room legibility while reading as "off".
//
// Everything is laid out in a 1000×1000 viewBox and scaled by the SVG, so
// there are no hardcoded 1080 values and the 800×480 device needs only a
// container change.

import ExerciseArt from './ExerciseArt';

const CX = 500;
const CY = 500;
const RING_R = 452;
const RING_W = 44;

export interface WatchFaceProps {
  /** 0–1 of the ring to fill. */
  progress: number;
  /** Large centred readout: the countdown, or a label like "FULL BODY". */
  headline: string;
  /** Two bars in place of the readout while the circuit is held. */
  paused: boolean;
  /** Small caption under the figure. */
  caption?: string;
  heartsTotal: number;
  heartsLeft: number;
  exerciseId: string | null;
  artPhase: 'work' | 'rest';
  playing: boolean;
  inverted: boolean;
}

// The streak allowance, drawn rather than set as an emoji.
//
// It was `❤️`, which put full-colour Apple glyphs on a face that is otherwise
// two inks and one ring, at a weight nothing else on the dial shares. Drawn, it
// takes the face's own ink like the caption does.
//
// Ink and not red on purpose: the progress ring is already this screen's one
// saturated quantity, and a second one competes with it for the same glance.
// Spent hearts drop to 0.22, which is how the emoji version marked them too.
const HEART =
  'M 0 13 C -15 2, -21 -8, -12 -15 C -6 -19, -1 -15, 0 -10 ' +
  'C 1 -15, 6 -19, 12 -15 C 21 -8, 15 2, 0 13 Z';

function polar(r: number, deg: number): [number, number] {
  const rad = ((deg - 90) * Math.PI) / 180;
  return [CX + r * Math.cos(rad), CY + r * Math.sin(rad)];
}

export default function WatchFace(props: WatchFaceProps) {
  const { progress, headline, paused, caption, heartsTotal, heartsLeft } = props;
  const { exerciseId, artPhase, playing, inverted } = props;

  const circumference = 2 * Math.PI * RING_R;
  const clamped = Math.min(1, Math.max(0, progress));
  const [cometX, cometY] = polar(RING_R, clamped * 360);

  const face = inverted ? '#17181a' : '#f5f0eb';
  const track = inverted ? '#2a2c30' : '#e6ddd4';
  const ink = inverted ? '#f3efe9' : '#2a2d33';
  const muted = inverted ? '#8e8b86' : '#8b8279';

  return (
    <div className="flex h-full w-full items-center justify-center" style={{ background: face }}>
      <svg viewBox="0 0 1000 1000" className="h-full w-full max-h-full max-w-full">
        <defs>
          <linearGradient id="fitRing" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#8b1a1a" />
            <stop offset="55%" stopColor="#e33030" />
            <stop offset="100%" stopColor="#ff7a00" />
          </linearGradient>
        </defs>

        <circle cx={CX} cy={CY} r={RING_R} fill="none" stroke={track} strokeWidth={RING_W} />

        {clamped > 0 && (
          <circle
            cx={CX} cy={CY} r={RING_R}
            fill="none"
            stroke="url(#fitRing)"
            strokeWidth={RING_W}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - clamped)}
            style={{ transform: 'rotate(-90deg)', transformOrigin: `${CX}px ${CY}px` }}
          />
        )}

        {clamped > 0 && <circle cx={cometX} cy={cometY} r={22} fill="#ffb03a" />}

        {paused ? (
          <g fill={ink}>
            <rect x={CX - 54} y={188} width={38} height={92} rx={12} />
            <rect x={CX + 16} y={188} width={38} height={92} rx={12} />
          </g>
        ) : (
        <text
          x={CX} y={230}
          textAnchor="middle" dominantBaseline="middle"
          fill={ink}
          fontFamily="Inter, sans-serif"
          fontWeight="850"
          fontSize={headline.length > 3 ? 96 : 168}
          letterSpacing="-0.03em"
        >
          {headline}
        </text>
        )}

        {exerciseId && (
          <foreignObject x={280} y={300} width={440} height={400}>
            <ExerciseArt exerciseId={exerciseId} phase={artPhase} playing={playing} />
          </foreignObject>
        )}

        {caption && (
          <text
            x={CX} y={772}
            textAnchor="middle"
            fill={muted}
            fontFamily="Inter, sans-serif"
            fontWeight="650"
            fontSize={34}
            letterSpacing="0.08em"
          >
            {caption.toUpperCase()}
          </text>
        )}

        <g fill={ink}>
          {Array.from({ length: heartsTotal }, (_, i) => (
            <path
              key={i}
              d={HEART}
              transform={`translate(${CX - (heartsTotal - 1) * 40 + i * 80} 846)`}
              opacity={i < heartsLeft ? 1 : 0.22}
            />
          ))}
        </g>
      </svg>
    </div>
  );
}
