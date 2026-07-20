import { useClockHands } from '../../core/hooks/useClockHands';
import { analogFaceSchema } from '../../shared/schemas/face.analog';
import type { FaceProps } from './face-components';

const ROMAN = ['XII', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];

/** Swiss railway-style analog clock — based on Figma S10 design (489:21023) */
export default function AnalogClock({ isActive, faceConfig }: FaceProps) {
  const { hourDeg, minuteDeg, secondDeg } = useClockHands(isActive);

  // Admin-configured face options (schema fills defaults; invalid saved
  // values fall back to pure defaults rather than crashing the kiosk).
  const parsed = analogFaceSchema.safeParse(faceConfig ?? {});
  const { accent, numeralStyle, showSeconds } = parsed.success
    ? parsed.data
    : analogFaceSchema.parse({});

  // Generate tick marks
  const ticks = [];
  for (let i = 0; i < 60; i++) {
    const isHour = i % 5 === 0;
    const angle = i * 6;
    ticks.push(
      <line
        key={i}
        x1="500"
        y1={isHour ? 20 : 40}
        x2="500"
        y2={isHour ? 80 : 65}
        stroke="currentColor"
        strokeWidth={isHour ? 12 : 4}
        strokeLinecap="round"
        transform={`rotate(${angle} 500 500)`}
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
          const x = 500 + r * Math.sin(angle);
          const y = 500 - r * Math.cos(angle);
          const label = numeralStyle === 'roman' ? ROMAN[i] : String(i === 0 ? 12 : i);
          return (
            <text
              key={i}
              x={x}
              y={y}
              fill="white"
              fontSize="72"
              fontWeight="500"
              textAnchor="middle"
              dominantBaseline="central"
            >
              {label}
            </text>
          );
        });

  return (
    <div className="flex h-full w-full items-center justify-center bg-black">
      <svg viewBox="0 0 1000 1000" className="h-full w-full max-h-screen max-w-screen">
        {/* Clock face */}
        <circle cx="500" cy="500" r="500" fill="#000000" />

        {/* Tick marks */}
        <g className="text-white">{ticks}</g>

        {numerals}

        {/* Hour hand */}
        <line
          x1="500"
          y1="500"
          x2="500"
          y2="220"
          stroke="white"
          strokeWidth="28"
          strokeLinecap="round"
          style={{ transform: `rotate(${hourDeg}deg)`, transformOrigin: '500px 500px' }}
        />

        {/* Minute hand */}
        <line
          x1="500"
          y1="500"
          x2="500"
          y2="120"
          stroke="white"
          strokeWidth="20"
          strokeLinecap="round"
          style={{ transform: `rotate(${minuteDeg}deg)`, transformOrigin: '500px 500px' }}
        />

        {/* Second hand */}
        {showSeconds && (
          <line
            x1="500"
            y1="580"
            x2="500"
            y2="150"
            stroke={accent}
            strokeWidth="6"
            strokeLinecap="round"
            style={{
              transform: `rotate(${secondDeg}deg)`,
              transformOrigin: '500px 500px',
              transition: 'transform 0.2s cubic-bezier(0.4, 2.08, 0.55, 0.44)',
            }}
          />
        )}

        {/* Center dot */}
        <circle cx="500" cy="500" r="12" fill={accent} />
        <circle cx="500" cy="500" r="6" fill="#000000" />
      </svg>
    </div>
  );
}
