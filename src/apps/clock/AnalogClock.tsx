import { useClockHands } from '../../core/hooks/useClockHands';
import { analogFaceSchema } from '../../shared/schemas/face.analog';
import { resolveSpecColor, specOf } from '../../shared/part-meta';
import analogMeta from './AnalogClock.meta.json';
import type { FaceProps } from './face-components';

const ROMAN = ['XII', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];

// Every hand, tick and dot number comes from the contract beside this file;
// the parity test diffs slow-native/src/clock_face.c against the same numbers.
// The numeral ring (radius 340, 72px type) is not in the spec vocabulary and
// stays here on purpose.
const spec = specOf(analogMeta, 'AnalogClock.meta.json');
// Checked on the raw spec.* paths (not the destructured names below) so the
// narrowing survives into AnalogClock(): TS resets a narrowed *outer* const
// at a nested-function boundary, but a const declared from an
// already-narrowed expression keeps that type as its own.
if (!spec.ticks || !spec.dot || !spec.hands.second) {
  throw new Error('AnalogClock.meta.json spec must declare ticks, dot and a second hand');
}
const tickSpec = spec.ticks;
const dotSpec = spec.dot;
const secondSpec = spec.hands.second;
const C = spec.space / 2;

/** Swiss railway-style analog clock — based on Figma S10 design (489:21023) */
export default function AnalogClock({ isActive, faceConfig }: FaceProps) {
  const { hourDeg, minuteDeg, secondDeg } = useClockHands(isActive);

  // Admin-configured face options (schema fills defaults; invalid saved
  // values fall back to pure defaults rather than crashing the kiosk).
  const parsed = analogFaceSchema.safeParse(faceConfig ?? {});
  const { accent, numeralStyle, showSeconds } = parsed.success
    ? parsed.data
    : analogFaceSchema.parse({});
  const colors = { accent };
  const ink = resolveSpecColor(spec.face.ink, colors);
  const background = resolveSpecColor(spec.face.background, colors);

  // Generate tick marks
  const ticks = [];
  for (let i = 0; i < 60; i++) {
    const isHour = i % 5 === 0;
    const t = isHour ? tickSpec.hour : tickSpec.minute;
    ticks.push(
      <line
        key={i}
        x1={C}
        y1={C - t.outer}
        x2={C}
        y2={C - t.inner}
        stroke={ink}
        strokeWidth={t.width}
        strokeLinecap="round"
        transform={`rotate(${i * 6} ${C} ${C})`}
      />,
    );
  }

  // Hour numerals ring, just inside the ticks.
  const numerals =
    numeralStyle === 'none'
      ? null
      : Array.from({ length: 12 }, (_, i) => {
          const angle = (i * 30 * Math.PI) / 180;
          const r = 340;
          const x = C + r * Math.sin(angle);
          const y = C - r * Math.cos(angle);
          const label = numeralStyle === 'roman' ? ROMAN[i] : String(i === 0 ? 12 : i);
          return (
            <text
              key={i}
              x={x}
              y={y}
              fill={ink}
              fontSize="72"
              fontWeight="500"
              textAnchor="middle"
              dominantBaseline="central"
            >
              {label}
            </text>
          );
        });

  const hand = (deg: number, tip: number, width: number, stroke: string, tail = 0, style = {}) => (
    <line
      x1={C}
      y1={C + tail}
      x2={C}
      y2={C - tip}
      stroke={stroke}
      strokeWidth={width}
      strokeLinecap="round"
      style={{ transform: `rotate(${deg}deg)`, transformOrigin: `${C}px ${C}px`, ...style }}
    />
  );

  return (
    <div className="flex h-full w-full items-center justify-center bg-black">
      <svg viewBox={`0 0 ${spec.space} ${spec.space}`} className="h-full w-full max-h-screen max-w-screen">
        {/* Clock face */}
        <circle cx={C} cy={C} r={spec.radius} fill={background} />

        {/* Tick marks */}
        <g>{ticks}</g>

        {numerals}

        {/* Hour hand */}
        {hand(hourDeg, spec.hands.hour.tip, spec.hands.hour.width, resolveSpecColor(spec.hands.hour.color ?? spec.face.ink, colors))}

        {/* Minute hand */}
        {hand(minuteDeg, spec.hands.minute.tip, spec.hands.minute.width, resolveSpecColor(spec.hands.minute.color ?? spec.face.ink, colors))}

        {/* Second hand */}
        {showSeconds &&
          hand(
            secondDeg,
            secondSpec.tip,
            secondSpec.width,
            resolveSpecColor(secondSpec.color ?? spec.face.ink, colors),
            secondSpec.tail ?? 0,
            { transition: 'transform 0.2s cubic-bezier(0.4, 2.08, 0.55, 0.44)' },
          )}

        {/* Center dot */}
        <circle cx={C} cy={C} r={dotSpec.outer} fill={resolveSpecColor(dotSpec.outerColor ?? spec.face.ink, colors)} />
        <circle cx={C} cy={C} r={dotSpec.inner} fill={resolveSpecColor(dotSpec.innerColor ?? spec.face.background, colors)} />
      </svg>
    </div>
  );
}
