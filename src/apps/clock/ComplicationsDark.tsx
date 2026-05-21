import { useState, useEffect } from 'react';
import type { AppProps } from '../../core/types';
import { useContinuousSecondAngle } from '../../core/hooks/useContinuousSecondAngle';

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

export default function ComplicationsDark({ isActive }: AppProps) {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    if (!isActive) return;
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, [isActive]);

  const hours = time.getHours() % 12;
  const minutes = time.getMinutes();
  const seconds = time.getSeconds();
  const hourDeg = hours * 30 + minutes * 0.5;
  const minuteDeg = minutes * 6 + seconds * 0.1;
  const secondDeg = useContinuousSecondAngle(seconds);

  const dayName = time.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
  const dateNum = time.getDate();

  const ticks = [];
  for (let i = 0; i < 60; i++) {
    const isHour = i % 5 === 0;
    const angle = i * 6;
    ticks.push(
      <line
        key={i}
        x1="500" y1={isHour ? 22 : 40} x2="500" y2={isHour ? 68 : 60}
        stroke={isHour ? '#888' : '#555'} strokeWidth={isHour ? 8 : 4} strokeLinecap="round"
        transform={`rotate(${angle} 500 500)`}
      />,
    );
  }

  const style = (deg: number) => ({
    transform: `rotate(${deg}deg)`,
    transformOrigin: '500px 500px',
  });

  return (
    <div className="flex h-full w-full items-center justify-center bg-black">
      <svg viewBox="0 0 1000 1000" className="h-full w-full max-h-screen max-w-screen">
        {/* Black face */}
        <circle cx="500" cy="500" r="500" fill="#000" />

        {/* Tick marks */}
        {ticks}

        {/* ── Top complication: caffeine ── */}
        <circle cx={COMPS.top.cx} cy={COMPS.top.cy} r={COMP_R} fill="#1e1e1e" />
        <text x={COMPS.top.cx} y={COMPS.top.cy - 22} textAnchor="middle" fontSize="62" dominantBaseline="auto">☕</text>
        <text x={COMPS.top.cx} y={COMPS.top.cy + 46} textAnchor="middle" fill="white" fontSize="50" fontWeight="700" fontFamily="system-ui">2</text>

        {/* ── Left complication: habit ring ── */}
        <circle
          cx={COMPS.left.cx} cy={COMPS.left.cy} r={COMP_R + 14}
          fill="none" stroke="#22c55e" strokeWidth="12" strokeLinecap="round"
          strokeDasharray={arcDash(COMP_R + 14, 0.65)}
          transform={`rotate(-90 ${COMPS.left.cx} ${COMPS.left.cy})`}
        />
        <circle cx={COMPS.left.cx} cy={COMPS.left.cy} r={COMP_R} fill="#1e1e1e" />
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
        <circle cx={COMPS.right.cx} cy={COMPS.right.cy} r={COMP_R} fill="#1e1e1e" />
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
        <ellipse cx={COMPS.right.cx + 10} cy={COMPS.right.cy - 6} rx="36" ry="20" fill="#ccc" />
        <ellipse cx={COMPS.right.cx - 14} cy={COMPS.right.cy - 10} rx="22" ry="16" fill="#ccc" />
        <text x={COMPS.right.cx} y={COMPS.right.cy + 46} textAnchor="middle" fill="#fbbf24" fontSize="38" fontWeight="700" fontFamily="system-ui">42°C</text>

        {/* ── Bottom complication: date ── */}
        <circle cx={COMPS.bottom.cx} cy={COMPS.bottom.cy} r={COMP_R} fill="#1e1e1e" />
        <text x={COMPS.bottom.cx} y={COMPS.bottom.cy - 22} textAnchor="middle" fill="#666" fontSize="38" fontFamily="system-ui" letterSpacing="3">{dayName}</text>
        <text x={COMPS.bottom.cx} y={COMPS.bottom.cy + 48} textAnchor="middle" fill="white" fontSize="62" fontWeight="700" fontFamily="system-ui">{dateNum}</text>

        {/* ── Clock hands ── */}
        {/* Center hub (behind hands) */}
        <circle cx="500" cy="500" r="14" fill="#7c3aed" />

        {/* Hour — light gray */}
        <line x1="500" y1="535" x2="500" y2="310" stroke="#ccc" strokeWidth="32" strokeLinecap="round" style={style(hourDeg)} />
        {/* Minute — lighter */}
        <line x1="500" y1="530" x2="500" y2="182" stroke="#ddd" strokeWidth="22" strokeLinecap="round" style={style(minuteDeg)} />
        {/* Second — violet */}
        <line x1="500" y1="572" x2="500" y2="152" stroke="#7c3aed" strokeWidth="7" strokeLinecap="round"
          style={{
            transform: `rotate(${secondDeg}deg)`,
            transformOrigin: '500px 500px',
            transition: 'transform 0.2s cubic-bezier(0.4, 2.08, 0.55, 0.44)',
          }}
        />
        {/* Center pip */}
        <circle cx="500" cy="500" r="16" fill="#7c3aed" />
        <circle cx="500" cy="500" r="7" fill="#1e1e1e" />
      </svg>
    </div>
  );
}
