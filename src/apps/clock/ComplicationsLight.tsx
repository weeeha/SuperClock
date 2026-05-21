import type { AppProps } from '../../core/types';
import { useClockHands } from '../../core/hooks/useClockHands';

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

export default function ComplicationsLight({ isActive }: AppProps) {
  const { time, hourDeg, minuteDeg, secondDeg } = useClockHands(isActive);

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
        stroke="#444" strokeWidth={isHour ? 9 : 4} strokeLinecap="round"
        transform={`rotate(${angle} 500 500)`}
      />,
    );
  }

  const style = (deg: number) => ({
    transform: `rotate(${deg}deg)`,
    transformOrigin: '500px 500px',
  });

  return (
    <div className="flex h-full w-full items-center justify-center">
      <svg viewBox="0 0 1000 1000" className="h-full w-full max-h-screen max-w-screen">
        <defs>
          <filter id="cl-shadow">
            <feDropShadow dx="0" dy="3" stdDeviation="5" floodOpacity="0.22" />
          </filter>
        </defs>

        {/* White face */}
        <circle cx="500" cy="500" r="500" fill="white" />

        {/* Tick marks */}
        {ticks}

        {/* Brand mark at 12 — two linked circles */}
        <circle cx="489" cy="88" r="9" fill="none" stroke="#666" strokeWidth="4" />
        <circle cx="511" cy="88" r="9" fill="none" stroke="#666" strokeWidth="4" />

        {/* ── Top complication: caffeine ── */}
        <circle cx={COMPS.top.cx} cy={COMPS.top.cy} r={COMP_R} fill="#1a1a1a" />
        <text x={COMPS.top.cx} y={COMPS.top.cy - 22} textAnchor="middle" fontSize="62" dominantBaseline="auto">☕</text>
        <text x={COMPS.top.cx} y={COMPS.top.cy + 46} textAnchor="middle" fill="white" fontSize="50" fontWeight="700" fontFamily="system-ui">2</text>

        {/* ── Left complication: habit ring ── */}
        {/* Progress arc outside the circle */}
        <circle
          cx={COMPS.left.cx} cy={COMPS.left.cy} r={COMP_R + 14}
          fill="none" stroke="#22c55e" strokeWidth="12" strokeLinecap="round"
          strokeDasharray={arcDash(COMP_R + 14, 0.65)}
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
            fill="#22c55e"
            opacity="0.85"
            transform={`rotate(${i * 60} ${COMPS.left.cx} ${COMPS.left.cy})`}
          />
        ))}
        <circle cx={COMPS.left.cx} cy={COMPS.left.cy} r="16" fill="#22c55e" />

        {/* ── Right complication: weather ── */}
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

        {/* ── Bottom complication: date ── */}
        <circle cx={COMPS.bottom.cx} cy={COMPS.bottom.cy} r={COMP_R} fill="#1a1a1a" />
        <text x={COMPS.bottom.cx} y={COMPS.bottom.cy - 22} textAnchor="middle" fill="#999" fontSize="38" fontFamily="system-ui" letterSpacing="3">{dayName}</text>
        <text x={COMPS.bottom.cx} y={COMPS.bottom.cy + 48} textAnchor="middle" fill="white" fontSize="62" fontWeight="700" fontFamily="system-ui">{dateNum}</text>

        {/* ── Clock hands ── */}
        {/* Hour — white border + dark fill */}
        <line x1="500" y1="535" x2="500" y2="310" stroke="white" strokeWidth="44" strokeLinecap="round" style={style(hourDeg)} />
        <line x1="500" y1="535" x2="500" y2="310" stroke="#111" strokeWidth="32" strokeLinecap="round" filter="url(#cl-shadow)" style={style(hourDeg)} />
        {/* Minute */}
        <line x1="500" y1="530" x2="500" y2="182" stroke="white" strokeWidth="34" strokeLinecap="round" style={style(minuteDeg)} />
        <line x1="500" y1="530" x2="500" y2="182" stroke="#111" strokeWidth="24" strokeLinecap="round" filter="url(#cl-shadow)" style={style(minuteDeg)} />
        {/* Second — golden */}
        <line x1="500" y1="572" x2="500" y2="152" stroke="#f59e0b" strokeWidth="7" strokeLinecap="round"
          style={{
            transform: `rotate(${secondDeg}deg)`,
            transformOrigin: '500px 500px',
            transition: 'transform 0.2s cubic-bezier(0.4, 2.08, 0.55, 0.44)',
          }}
        />
        {/* Center pip */}
        <circle cx="500" cy="500" r="18" fill="#f59e0b" />
        <circle cx="500" cy="500" r="9" fill="#111" />
      </svg>
    </div>
  );
}
