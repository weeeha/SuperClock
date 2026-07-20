import type { AppProps } from '../../core/types';
import { useClockHands } from '../../core/hooks/useClockHands';

// One formatter per timezone, built once — Intl.DateTimeFormat construction
// costs milliseconds on a Pi and this used to run 5× per second.
const tzFormatters = new Map<string, Intl.DateTimeFormat>();

function getTimeInTZ(date: Date, tz: string) {
  let fmt = tzFormatters.get(tz);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      hour12: false,
    });
    tzFormatters.set(tz, fmt);
  }
  const parts = fmt.formatToParts(date);
  const get = (t: string) => parseInt(parts.find((p) => p.type === t)?.value ?? '0');
  return { h: get('hour') % 12, m: get('minute') };
}

interface MiniClockProps {
  cx: number;
  cy: number;
  r: number;
  h: number;
  m: number;
  label: string;
}

function MiniClock({ cx, cy, r, h, m, label }: MiniClockProps) {
  const hourDeg = h * 30 + m * 0.5;
  const minuteDeg = m * 6;

  const ticks = Array.from({ length: 12 }, (_, i) => {
    const rad = ((i * 30 - 90) * Math.PI) / 180;
    return (
      <line
        key={i}
        x1={cx + (r - 9) * Math.cos(rad)}
        y1={cy + (r - 9) * Math.sin(rad)}
        x2={cx + (r - 20) * Math.cos(rad)}
        y2={cy + (r - 20) * Math.sin(rad)}
        stroke="#555"
        strokeWidth="5"
        strokeLinecap="round"
      />
    );
  });

  const hRad = ((hourDeg - 90) * Math.PI) / 180;
  const mRad = ((minuteDeg - 90) * Math.PI) / 180;

  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill="#1c1c1c" />
      {ticks}
      {/* Hour hand */}
      <line
        x1={cx} y1={cy}
        x2={cx + r * 0.52 * Math.cos(hRad)}
        y2={cy + r * 0.52 * Math.sin(hRad)}
        stroke="white" strokeWidth="9" strokeLinecap="round"
      />
      {/* Minute hand */}
      <line
        x1={cx} y1={cy}
        x2={cx + r * 0.72 * Math.cos(mRad)}
        y2={cy + r * 0.72 * Math.sin(mRad)}
        stroke="white" strokeWidth="6" strokeLinecap="round"
      />
      <circle cx={cx} cy={cy} r="7" fill="#333" />
      {/* City label */}
      <text
        x={cx} y={cy + r * 0.46}
        textAnchor="middle"
        fill="#FF8C00"
        fontSize={r * 0.24}
        fontWeight="700"
        fontFamily="system-ui, sans-serif"
      >
        {label}
      </text>
    </g>
  );
}

// Five cities: top-left, top-right, left, right, bottom
const ZONES = [
  { cx: 330, cy: 268, r: 148, tz: 'America/Los_Angeles', label: 'LA' },
  { cx: 667, cy: 268, r: 148, tz: 'America/New_York', label: 'NYC' },
  { cx: 229, cy: 592, r: 148, tz: 'Europe/London', label: 'LDN' },
  { cx: 774, cy: 592, r: 148, tz: 'Asia/Dubai', label: 'DXB' },
  { cx: 499, cy: 787, r: 148, tz: 'Asia/Tokyo', label: 'TYO' },
];

export default function WorldClock({ isActive }: AppProps) {
  const { time, hourDeg, minuteDeg, secondDeg } = useClockHands(isActive);

  const ticks = [];
  for (let i = 0; i < 60; i++) {
    const isHour = i % 5 === 0;
    const angle = i * 6;
    ticks.push(
      <line
        key={i}
        x1="500" y1={isHour ? 18 : 34} x2="500" y2={isHour ? 60 : 54}
        stroke={isHour ? '#777' : '#444'} strokeWidth={isHour ? 8 : 4} strokeLinecap="round"
        transform={`rotate(${angle} 500 500)`}
      />,
    );
  }

  return (
    <div className="flex h-full w-full items-center justify-center bg-black">
      <svg viewBox="0 0 1000 1000" className="h-full w-full max-h-screen max-w-screen">
        {/* Face */}
        <circle cx="500" cy="500" r="500" fill="#000" />
        {ticks}

        {/* Mini timezone clocks */}
        {ZONES.map(({ cx, cy, r, tz, label }) => {
          const { h, m } = getTimeInTZ(time, tz);
          return <MiniClock key={tz} cx={cx} cy={cy} r={r} h={h} m={m} label={label} />;
        })}

        {/* Main hour hand — gray, overlaid on top */}
        <line
          x1="500" y1="530" x2="500" y2="205"
          stroke="#ccc" strokeWidth="26" strokeLinecap="round"
          style={{ transform: `rotate(${hourDeg}deg)`, transformOrigin: '500px 500px' }}
        />
        {/* Main minute hand */}
        <line
          x1="500" y1="530" x2="500" y2="130"
          stroke="#ddd" strokeWidth="18" strokeLinecap="round"
          style={{ transform: `rotate(${minuteDeg}deg)`, transformOrigin: '500px 500px' }}
        />
        {/* Second hand — red */}
        <line
          x1="500" y1="590" x2="500" y2="115"
          stroke="#e00" strokeWidth="6" strokeLinecap="round"
          style={{
            transform: `rotate(${secondDeg}deg)`,
            transformOrigin: '500px 500px',
            transition: 'transform 0.2s cubic-bezier(0.4, 2.08, 0.55, 0.44)',
          }}
        />
        {/* Center hub */}
        <circle cx="500" cy="500" r="18" fill="#111" stroke="#e00" strokeWidth="5" />
      </svg>
    </div>
  );
}
