import type { CSSProperties } from 'react';
import type { MicState } from './mic-state';
import './agents.css';

const RING = '#3dadff';

/** Always-on-mic indicator: a ring just inside the bezel.
 *  idle: near-invisible · listening: breathing · thinking: rotating conic gap
 *  (shimmer) · speaking: steady bright. Parent must gate rendering on
 *  isActive — an unmounted ring is the cheapest ring. */
export default function StateRing({ state }: { state: MicState }) {
  const base: CSSProperties = {
    position: 'absolute',
    inset: 10,
    borderRadius: '50%',
    border: `7px solid ${RING}`,
    pointerEvents: 'none',
  };
  if (state === 'idle') return <div style={{ ...base, opacity: 0.08 }} />;
  if (state === 'listening')
    return (
      <div style={{ ...base, animation: 'agents-ring-breathe 2.4s ease-in-out infinite' }} />
    );
  if (state === 'thinking')
    return (
      <div
        style={{
          ...base,
          border: 'none',
          background: `conic-gradient(${RING} 0deg, ${RING} 300deg, transparent 300deg)`,
          WebkitMask:
            'radial-gradient(closest-side, transparent calc(100% - 7px), black calc(100% - 7px))',
          mask: 'radial-gradient(closest-side, transparent calc(100% - 7px), black calc(100% - 7px))',
          animation: 'agents-ring-shimmer 3s linear infinite',
        }}
      />
    );
  return <div style={{ ...base, opacity: 1 }} />; // speaking
}
