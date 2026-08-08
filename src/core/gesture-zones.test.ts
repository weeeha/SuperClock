// src/core/gesture-zones.test.ts
import { describe, it, expect } from 'vitest';
import { classifyTouchStart, RING_FRACTION } from './gesture-zones';

// Viewport is 1080×1080 on-device; classification must scale with size,
// so tests use 1000×1000 for round numbers. radius=500, ring=500*RING_FRACTION.
const W = 1000;
const H = 1000;

describe('classifyTouchStart', () => {
  it('center of the screen is inner', () => {
    expect(classifyTouchStart(500, 500, W, H)).toBe('inner');
  });

  it('just inside the ring boundary is inner', () => {
    const innerEdge = 500 - 500 * RING_FRACTION - 1; // 1px inside the ring
    expect(classifyTouchStart(500 + innerEdge, 500, W, H)).toBe('inner');
  });

  it('top of the rim (12 o\'clock) is top-arc', () => {
    expect(classifyTouchStart(500, 10, W, H)).toBe('top-arc');
  });

  it('bottom of the rim (6 o\'clock) is bottom-arc', () => {
    expect(classifyTouchStart(500, 990, W, H)).toBe('bottom-arc');
  });

  it('left of the rim (9 o\'clock) is left-arc', () => {
    expect(classifyTouchStart(10, 500, W, H)).toBe('left-arc');
  });

  it('right of the rim (3 o\'clock) is right-arc', () => {
    expect(classifyTouchStart(990, 500, W, H)).toBe('right-arc');
  });

  it('rim at 45° (between top and right arcs) belongs to exactly one arc', () => {
    // 45° from vertical — the boundary. ±45° spans mean this is the seam;
    // it must classify (not throw) and be one of the two adjacent arcs.
    const d = 490 / Math.SQRT2;
    const zone = classifyTouchStart(500 + d, 500 - d, W, H);
    expect(['top-arc', 'right-arc']).toContain(zone);
  });

  it('corners of the square viewport (outside the disc) are rim arcs, not inner', () => {
    // A touch reported outside the disc entirely (square panel corners)
    // still classifies by angle.
    expect(classifyTouchStart(2, 2, W, H)).not.toBe('inner');
  });
});
