import { useMemo, useState } from 'react';
import { useClockHands } from '../../core/hooks/useClockHands';
import { strokesFaceSchema } from '../../shared/schemas/face.strokes';
import { DIAL_R, HAND_LEN, buildLattice, stepModel } from './strokes-geometry';
import type { StrokesModel } from './strokes-geometry';
import type { FaceProps } from './face-components';

const EASE = 'cubic-bezier(0.4, 0, 0.2, 1)';

/**
 * Composed Strokes — a full-field lattice of 52 two-hand dials; the centre
 * 4x6 block composes HH/MM digit strokes, everything else parks dim on the
 * south-west diagonal. Perfectly still between minutes; a minute step sweeps
 * only the changed hands clockwise (2.4s, 45ms reading-order stagger).
 *
 * All geometry and angle bookkeeping lives in strokes-geometry.ts; this file
 * only renders a StrokesModel.
 */
export default function StrokesClock({ isActive, faceConfig }: FaceProps) {
  const { time } = useClockHands(isActive);

  const parsed = strokesFaceSchema.safeParse(faceConfig ?? {});
  const { format } = parsed.success ? parsed.data : strokesFaceSchema.parse({});

  const lattice = useMemo(() => buildLattice(), []);

  // Derive-during-render with a key guard (React's "adjusting state during
  // render" pattern): the hook ticks every second, but the model only steps
  // when the minute (or format) changes, so 59 renders in 60 diff to nothing.
  const [model, setModel] = useState<StrokesModel>(() =>
    stepModel(null, lattice, time.getHours(), time.getMinutes(), format),
  );
  const key = `${time.getHours() * 60 + time.getMinutes()}:${format}`;
  if (model.key !== key) {
    setModel(stepModel(model, lattice, time.getHours(), time.getMinutes(), format));
  }

  return (
    <div className="theme-fade flex h-full w-full items-center justify-center bg-(--face-bg)">
      <svg viewBox="0 0 1000 1000" className="h-full w-full max-h-screen max-w-screen">
        {lattice.map((cell, i) => {
          const color = model.parked[i] ? 'var(--face-ghost)' : 'var(--color-accent)';
          return (
            <g key={`${cell.col},${cell.row}`}>
              <circle cx={cell.cx} cy={cell.cy} r={DIAL_R} fill="var(--face-plate)" />
              {([0, 1] as const).map((j) => {
                const idx = 2 * i + j;
                const transition =
                  model.animate && model.moved[idx]
                    ? `transform 2.4s ${EASE} ${Math.min(model.delayRank[idx] * 45, 500)}ms, stroke 2.4s ${EASE}`
                    : 'none';
                return (
                  <g
                    key={j}
                    style={{
                      transform: `translate(${cell.cx}px, ${cell.cy}px) rotate(${model.angles[idx]}deg)`,
                      transition,
                    }}
                  >
                    <line
                      x1="0"
                      y1="0"
                      x2="0"
                      y2={-HAND_LEN}
                      stroke={color}
                      strokeWidth="13"
                      strokeLinecap="round"
                    />
                  </g>
                );
              })}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
