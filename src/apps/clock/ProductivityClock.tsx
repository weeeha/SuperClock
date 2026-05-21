import { useState, useEffect } from 'react';
import type { AppProps } from '../../core/types';
import { useContinuousSecondAngle } from '../../core/hooks/useContinuousSecondAngle';

/** Productivity clock with colored segments — based on Figma S3 design (489:20734) */
export default function ProductivityClock({ isActive }: AppProps) {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    if (!isActive) return;
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, [isActive]);

  const hours = time.getHours() % 12;
  const minutes = time.getMinutes();
  const seconds = time.getSeconds();
  const day = time.toLocaleDateString('en-US', { weekday: 'short' });
  const date = time.getDate();

  const hourDeg = hours * 30 + minutes * 0.5;
  const minuteDeg = minutes * 6 + seconds * 0.1;
  const secondDeg = useContinuousSecondAngle(seconds);

  // Colored time block segments around the rim
  const segments = [
    { start: 0, end: 90, color: '#3366FF' },
    { start: 90, end: 140, color: '#FF8826' },
    { start: 140, end: 200, color: '#E33030' },
    { start: 200, end: 240, color: '#22C55E' },
    { start: 240, end: 280, color: '#3366FF' },
    { start: 280, end: 310, color: '#22C55E' },
    { start: 310, end: 330, color: '#60A5FA' },
    { start: 330, end: 350, color: '#A855F7' },
  ];

  // Generate tick marks
  const ticks = [];
  for (let i = 0; i < 60; i++) {
    const isHour = i % 5 === 0;
    const angle = i * 6;
    ticks.push(
      <line
        key={i}
        x1="500"
        y1={isHour ? 90 : 105}
        x2="500"
        y2={isHour ? 130 : 122}
        stroke="white"
        strokeWidth={isHour ? 6 : 2}
        strokeLinecap="round"
        transform={`rotate(${angle} 500 500)`}
      />,
    );
  }

  function arcPath(startAngle: number, endAngle: number, r: number, thickness: number) {
    const toRad = (a: number) => ((a - 90) * Math.PI) / 180;
    const outer = r;
    const inner = r - thickness;
    const large = endAngle - startAngle > 180 ? 1 : 0;

    const x1 = 500 + outer * Math.cos(toRad(startAngle));
    const y1 = 500 + outer * Math.sin(toRad(startAngle));
    const x2 = 500 + outer * Math.cos(toRad(endAngle));
    const y2 = 500 + outer * Math.sin(toRad(endAngle));
    const x3 = 500 + inner * Math.cos(toRad(endAngle));
    const y3 = 500 + inner * Math.sin(toRad(endAngle));
    const x4 = 500 + inner * Math.cos(toRad(startAngle));
    const y4 = 500 + inner * Math.sin(toRad(startAngle));

    return `M${x1},${y1} A${outer},${outer} 0 ${large} 1 ${x2},${y2} L${x3},${y3} A${inner},${inner} 0 ${large} 0 ${x4},${y4} Z`;
  }

  return (
    <div className="flex h-full w-full items-center justify-center bg-black">
      <svg viewBox="0 0 1000 1000" className="h-full w-full max-h-screen max-w-screen">
        {/* Dark inner circle */}
        <circle cx="500" cy="500" r="500" fill="#000000" />

        {/* Colored segments */}
        {segments.map((seg, i) => (
          <path key={i} d={arcPath(seg.start, seg.end, 500, 65)} fill={seg.color} />
        ))}

        {/* Inner black circle */}
        <circle cx="500" cy="500" r="435" fill="#000000" />

        {/* Tick marks */}
        {ticks}

        {/* Date display */}
        <text x="500" y="310" textAnchor="middle" fill="white" fontSize="48" fontWeight="500" fontFamily="Inter, sans-serif">
          {day}
        </text>
        <text x="555" y="310" textAnchor="start" fill="#FF8826" fontSize="48" fontWeight="700" fontFamily="Inter, sans-serif">
          {date}
        </text>

        {/* Hour hand */}
        <line
          x1="500" y1="500" x2="500" y2="260"
          stroke="white" strokeWidth="22" strokeLinecap="round"
          style={{ transform: `rotate(${hourDeg}deg)`, transformOrigin: '500px 500px' }}
        />

        {/* Minute hand */}
        <line
          x1="500" y1="500" x2="500" y2="175"
          stroke="white" strokeWidth="16" strokeLinecap="round"
          style={{ transform: `rotate(${minuteDeg}deg)`, transformOrigin: '500px 500px' }}
        />

        {/* Second hand */}
        <line
          x1="500" y1="560" x2="500" y2="180"
          stroke="#FF8826" strokeWidth="4" strokeLinecap="round"
          style={{
            transform: `rotate(${secondDeg}deg)`,
            transformOrigin: '500px 500px',
            transition: 'transform 0.2s cubic-bezier(0.4, 2.08, 0.55, 0.44)',
          }}
        />

        {/* Center dot */}
        <circle cx="500" cy="500" r="10" fill="#FF8826" />
        <circle cx="500" cy="500" r="5" fill="black" />
      </svg>
    </div>
  );
}
