import { useState, useEffect } from 'react';
import type { AppProps } from '../../core/types';

interface PanelProps {
  value: string;
}

function FlipPanel({ value }: PanelProps) {
  const [current, setCurrent] = useState(value);
  const [prev, setPrev] = useState(value);
  const [flipping, setFlipping] = useState(false);

  useEffect(() => {
    if (value !== current && !flipping) {
      setPrev(current);
      setFlipping(true);
    }
  }, [value, current, flipping]);

  const handleAnimEnd = () => {
    setCurrent(value);
    setFlipping(false);
  };

  const numBase: React.CSSProperties = {
    position: 'absolute',
    left: 0,
    right: 0,
    height: '200%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '27vmin',
    fontWeight: 900,
    color: 'white',
    fontFamily: "'system-ui', '-apple-system', 'Helvetica Neue', sans-serif",
    fontVariantNumeric: 'tabular-nums',
    lineHeight: 1,
    letterSpacing: '-0.02em',
  };

  return (
    <div
      style={{
        width: '40vmin',
        height: '44vmin',
        borderRadius: '2.2vmin',
        overflow: 'hidden',
        position: 'relative',
        flexShrink: 0,
      }}
    >
      {/* Bottom half — shows bottom of current number */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: 0,
          right: 0,
          bottom: 0,
          background: '#1a1a1a',
          overflow: 'hidden',
        }}
      >
        <div style={{ ...numBase, top: '-100%' }}>{current}</div>
      </div>

      {/* Top half — shows top of current number */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: '50%',
          background: '#222',
          overflow: 'hidden',
        }}
      >
        <div style={{ ...numBase, top: 0 }}>{current}</div>
      </div>

      {/* Separator */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: 0,
          right: 0,
          height: 3,
          background: '#000',
          zIndex: 20,
          transform: 'translateY(-1px)',
        }}
      />

      {/* Animated flap: old top half folds down */}
      {flipping && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: '50%',
            background: '#222',
            overflow: 'hidden',
            transformOrigin: 'bottom center',
            animation: 'fc-flip-top 0.36s ease-in forwards',
            zIndex: 10,
          }}
          onAnimationEnd={handleAnimEnd}
        >
          <div style={{ ...numBase, top: 0 }}>{prev}</div>
        </div>
      )}
    </div>
  );
}

export default function FlipClock({ isActive }: AppProps) {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    if (!isActive) return;
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, [isActive]);

  const hh = String(time.getHours()).padStart(2, '0');
  const mm = String(time.getMinutes()).padStart(2, '0');

  return (
    <div className="flex h-full w-full items-center justify-center bg-black">
      <style>{`
        @keyframes fc-flip-top {
          0%   { transform: perspective(600px) rotateX(0deg); }
          100% { transform: perspective(600px) rotateX(-90deg); }
        }
      `}</style>
      <div style={{ display: 'flex', gap: '2.5vmin', alignItems: 'center' }}>
        <FlipPanel value={hh} />
        <FlipPanel value={mm} />
      </div>
    </div>
  );
}
