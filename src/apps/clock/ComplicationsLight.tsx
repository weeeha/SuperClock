import type { FaceProps } from './face-components';
import { useClockHands } from '../../core/hooks/useClockHands';
import { complicationsLightFaceSchema } from '../../shared/schemas/face.complications-light';
import { useHabitsToday } from './complications-data';
import CaffeineMark from './CaffeineMark';
import { Hands } from './Hands';
import { SECOND_HAND_SPRING } from '../../shared/hand-shadow';

// Complication circle centers (1000×1000 SVG space)
const COMP_R = 125;
const COMPS = {
  top: { cx: 500, cy: 275 },
  left: { cx: 280, cy: 500 },
  right: { cx: 740, cy: 500 },
  bottom: { cx: 500, cy: 736 },
};

function arcDash(r: number, pct: number) {
  const c = 2 * Math.PI * r;
  return `${c * pct} ${c}`;
}

export default function ComplicationsLight({ isActive, faceConfig }: FaceProps) {
  // Face options validated against face.complications-light, defaults otherwise.
  const parsedFace = complicationsLightFaceSchema.safeParse(faceConfig ?? {});
  const { accent, handShadow } = parsedFace.success ? parsedFace.data : complicationsLightFaceSchema.parse({});
  const { time, hourDeg, minuteDeg, secondDeg } = useClockHands(isActive);
  const habits = useHabitsToday(time);
  const habitPct = habits.total > 0 ? habits.done / habits.total : 0;

  const dayName = time.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
  const dateNum = time.getDate();

  const ticks = [];
  for (let i = 0; i < 60; i++) {
    const isHour = i % 5 === 0;
    const angle = i * 6;
    ticks.push(
      <line
        key={i}
        x1="500" y1={isHour ? 22 : 38} x2="500" y2={isHour ? 72 : 62}
        className="theme-fade stroke-(--face-tick)" strokeWidth={isHour ? 9 : 4} strokeLinecap="round"
        transform={`rotate(${angle} 500 500)`}
      />,
    );
  }

  return (
    <div className="flex h-full w-full items-center justify-center">
      <svg viewBox="0 0 1000 1000" className="h-full w-full max-h-screen max-w-screen">
        {/* Face (white by day, black at night) */}
        <circle cx="500" cy="500" r="500" className="theme-fade fill-(--face-bg)" />

        {/* Tick marks */}
        {ticks}

        {/* Brand mark at 12 — two linked circles */}
        <circle cx="489" cy="88" r="9" fill="none" className="theme-fade stroke-(--face-tick)" strokeWidth="4" />
        <circle cx="511" cy="88" r="9" fill="none" className="theme-fade stroke-(--face-tick)" strokeWidth="4" />

        {/* ── Top complication: caffeine (no real data source yet) ── */}
        <circle cx={COMPS.top.cx} cy={COMPS.top.cy} r={COMP_R} fill="#1a1a1a" />
        <g transform={`translate(${COMPS.top.cx} ${COMPS.top.cy - 46})`} color="white">
          <CaffeineMark />
        </g>
        <text x={COMPS.top.cx} y={COMPS.top.cy + 46} textAnchor="middle" fill="white" fontSize="50" fontWeight="700" fontFamily="system-ui">2</text>
        <text x={COMPS.top.cx} y={COMPS.top.cy + 84} textAnchor="middle" fill="#666" fontSize="22" fontFamily="system-ui" letterSpacing="2">DEMO</text>

        {/* ── Left complication: habit ring (live from HabitsApp storage) ── */}
        {/* Progress arc outside the circle */}
        <circle
          cx={COMPS.left.cx} cy={COMPS.left.cy} r={COMP_R + 14}
          fill="none" stroke={accent} strokeWidth="12" strokeLinecap="round"
          strokeDasharray={arcDash(COMP_R + 14, habitPct)}
          transform={`rotate(-90 ${COMPS.left.cx} ${COMPS.left.cy})`}
        />
        <circle cx={COMPS.left.cx} cy={COMPS.left.cy} r={COMP_R} fill="#1a1a1a" />
        {/* Simple flower icon */}
        {Array.from({ length: 6 }, (_, i) => (
          <ellipse
            key={i}
            cx={COMPS.left.cx}
            cy={COMPS.left.cy - 28}
            rx="13" ry="26"
            fill={accent}
            opacity="0.85"
            transform={`rotate(${i * 60} ${COMPS.left.cx} ${COMPS.left.cy})`}
          />
        ))}
        <circle cx={COMPS.left.cx} cy={COMPS.left.cy} r="16" fill={accent} />
        <text x={COMPS.left.cx} y={COMPS.left.cy + 92} textAnchor="middle" fill={accent} fontSize="28" fontWeight="700" fontFamily="system-ui">{habits.done}/{habits.total}</text>

        {/* ── Right complication: weather (no real data source yet) ── */}
        <circle cx={COMPS.right.cx} cy={COMPS.right.cy} r={COMP_R} fill="#1a1a1a" />
        {/* Sun */}
        <circle cx={COMPS.right.cx - 10} cy={COMPS.right.cy - 28} r="22" fill="#fbbf24" />
        {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
          <line
            key={a}
            x1={COMPS.right.cx - 10 + 27 * Math.sin((a * Math.PI) / 180)}
            y1={COMPS.right.cy - 28 - 27 * Math.cos((a * Math.PI) / 180)}
            x2={COMPS.right.cx - 10 + 34 * Math.sin((a * Math.PI) / 180)}
            y2={COMPS.right.cy - 28 - 34 * Math.cos((a * Math.PI) / 180)}
            stroke="#fbbf24" strokeWidth="5" strokeLinecap="round"
          />
        ))}
        {/* Cloud */}
        <ellipse cx={COMPS.right.cx + 10} cy={COMPS.right.cy - 6} rx="36" ry="20" fill="white" />
        <ellipse cx={COMPS.right.cx - 14} cy={COMPS.right.cy - 10} rx="22" ry="16" fill="white" />
        <text x={COMPS.right.cx} y={COMPS.right.cy + 46} textAnchor="middle" fill="#fbbf24" fontSize="38" fontWeight="700" fontFamily="system-ui">42°C</text>
        <text x={COMPS.right.cx} y={COMPS.right.cy + 84} textAnchor="middle" fill="#666" fontSize="22" fontFamily="system-ui" letterSpacing="2">DEMO</text>

        {/* ── Bottom complication: date ── */}
        <circle cx={COMPS.bottom.cx} cy={COMPS.bottom.cy} r={COMP_R} fill="#1a1a1a" />
        <text x={COMPS.bottom.cx} y={COMPS.bottom.cy - 22} textAnchor="middle" fill="#999" fontSize="38" fontFamily="system-ui" letterSpacing="3">{dayName}</text>
        <text x={COMPS.bottom.cx} y={COMPS.bottom.cy + 48} textAnchor="middle" fill="white" fontSize="62" fontWeight="700" fontFamily="system-ui">{dateNum}</text>

        {/* ── Clock hands: bordered hour and minute, golden second; the shadow is the handShadow option ── */}
        <Hands
          id="complications-light"
          shadow={handShadow}
          hands={[
            { deg: hourDeg, tip: 190, tail: 35, width: 44, stroke: 'white', core: { width: 32, stroke: '#111' } },
            { deg: minuteDeg, tip: 318, tail: 30, width: 34, stroke: 'white', core: { width: 24, stroke: '#111' } },
            { deg: secondDeg, tip: 348, tail: 72, width: 7, stroke: '#f59e0b', transition: SECOND_HAND_SPRING },
          ]}
        />
        {/* Center pip */}
        <circle cx="500" cy="500" r="18" fill="#f59e0b" />
        <circle cx="500" cy="500" r="9" fill="#111" />
      </svg>
    </div>
  );
}
