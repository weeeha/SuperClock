import { useState, useEffect } from 'react';
import type { AppProps } from '../../core/types';
import { useContinuousSecondAngle } from '../../core/hooks/useContinuousSecondAngle';

export default function FloralClock({ isActive }: AppProps) {
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

  return (
    <div className="flex h-full w-full items-center justify-center">
      <svg viewBox="0 0 1000 1000" className="h-full w-full max-h-screen max-w-screen">
        <defs>
          <radialGradient id="floral-bg" cx="38%" cy="35%" r="72%">
            <stop offset="0%" stopColor="#f0abfc" />
            <stop offset="30%" stopColor="#c084fc" />
            <stop offset="65%" stopColor="#818cf8" />
            <stop offset="100%" stopColor="#6366f1" />
          </radialGradient>
          <radialGradient id="fp1" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#f9a8d4" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#f9a8d4" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="fp2" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="white" stopOpacity="0.75" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="fp3" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#a78bfa" stopOpacity="0.75" />
            <stop offset="100%" stopColor="#a78bfa" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="fp4" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#e879f9" stopOpacity="0.7" />
            <stop offset="100%" stopColor="#e879f9" stopOpacity="0" />
          </radialGradient>
          <clipPath id="fc-clip">
            <circle cx="500" cy="500" r="500" />
          </clipPath>
        </defs>

        <circle cx="500" cy="500" r="500" fill="url(#floral-bg)" />

        <g clipPath="url(#fc-clip)">
          {/* Organic blobs */}
          <ellipse cx="290" cy="520" rx="310" ry="350" fill="url(#fp1)" />
          <ellipse cx="460" cy="470" rx="210" ry="230" fill="url(#fp2)" />
          <circle cx="710" cy="320" r="210" fill="url(#fp3)" />
          <circle cx="170" cy="260" r="130" fill="url(#fp4)" />
          <circle cx="790" cy="680" r="160" fill="#f472b6" opacity="0.38" />
          <circle cx="140" cy="760" r="115" fill="#a78bfa" opacity="0.42" />
          <circle cx="720" cy="150" r="95" fill="#f9a8d4" opacity="0.55" />
          <circle cx="600" cy="730" r="140" fill="#e879f9" opacity="0.3" />

          {/* Central flower — 8 translucent petals */}
          {Array.from({ length: 8 }, (_, i) => (
            <ellipse
              key={i}
              cx="500"
              cy="375"
              rx="42"
              ry="108"
              fill="white"
              opacity="0.52"
              transform={`rotate(${i * 45} 500 500)`}
            />
          ))}
          <circle cx="500" cy="500" r="65" fill="white" opacity="0.45" />
        </g>

        {/* Hour hand */}
        <line
          x1="500" y1="520" x2="500" y2="265"
          stroke="white" strokeWidth="24" strokeLinecap="round"
          style={{ transform: `rotate(${hourDeg}deg)`, transformOrigin: '500px 500px' }}
        />
        {/* Minute hand */}
        <line
          x1="500" y1="525" x2="500" y2="165"
          stroke="white" strokeWidth="15" strokeLinecap="round"
          style={{ transform: `rotate(${minuteDeg}deg)`, transformOrigin: '500px 500px' }}
        />
        {/* Second hand */}
        <line
          x1="500" y1="565" x2="500" y2="145"
          stroke="#fbbf24" strokeWidth="5" strokeLinecap="round"
          style={{
            transform: `rotate(${secondDeg}deg)`,
            transformOrigin: '500px 500px',
            transition: 'transform 0.2s cubic-bezier(0.4, 2.08, 0.55, 0.44)',
          }}
        />
        <circle cx="500" cy="500" r="14" fill="#fbbf24" />
        <circle cx="500" cy="500" r="7" fill="white" />
      </svg>
    </div>
  );
}
