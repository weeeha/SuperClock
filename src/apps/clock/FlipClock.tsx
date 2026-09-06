import { useState } from 'react';
import type { FaceProps } from './face-components';
import { useClockHands } from '../../core/hooks/useClockHands';
import { flipFaceSchema } from '../../shared/schemas/face.flip';

interface PanelProps {
  value: string;
  /** Digit colour — the face's `accent` option. */
  color: string;
}

function FlipPanel({ value, color }: PanelProps) {
  const [current, setCurrent] = useState(value);
  const [prev, setPrev] = useState(value);
  const [flipping, setFlipping] = useState(false);

  // Arm the flip when the digit changes. React's sanctioned "adjust state
  // during render" pattern — runs before paint (no extra committed frame) and
  // replaces a setState-in-Effect.
  if (value !== current && !flipping) {
    setPrev(current);
    setFlipping(true);
  }

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
    color,
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

export default function FlipClock({ isActive, faceConfig }: FaceProps) {
  const { time } = useClockHands(isActive);
  // Face options validated against face.flip, defaults otherwise (AnalogClock pattern).
  const parsed = flipFaceSchema.safeParse(faceConfig ?? {});
  const { accent, hour24 } = parsed.success ? parsed.data : flipFaceSchema.parse({});

  const hours = time.getHours();
  // 12-hour mode keeps two digits so the panel width never jumps (07, not 7).
  const hh = String(hour24 ? hours : ((hours + 11) % 12) + 1).padStart(2, '0');
  const mm = String(time.getMinutes()).padStart(2, '0');
  const meridiem = hours < 12 ? 'AM' : 'PM';

  return (
    <div className="flex h-full w-full items-center justify-center bg-black">
      <style>{`
        @keyframes fc-flip-top {
          0%   { transform: perspective(600px) rotateX(0deg); }
          100% { transform: perspective(600px) rotateX(-90deg); }
        }
      `}</style>
      <div style={{ display: 'flex', gap: '2.5vmin', alignItems: 'center' }}>
        <FlipPanel value={hh} color={accent} />
        <FlipPanel value={mm} color={accent} />
        {!hour24 && (
          <div
            style={{
              alignSelf: 'flex-end',
              paddingBottom: '2vmin',
              fontSize: '6vmin',
              fontWeight: 900,
              color: accent,
              opacity: 0.7,
              fontFamily: "'system-ui', '-apple-system', 'Helvetica Neue', sans-serif",
            }}
          >
            {meridiem}
          </div>
        )}
      </div>
    </div>
  );
}
