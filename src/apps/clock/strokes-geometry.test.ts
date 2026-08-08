import { describe, expect, it } from 'vitest';
import {
  DIAL_R,
  DIGIT_FONT,
  PARK_ANGLE,
  advanceClockwise,
  buildLattice,
  composeTargets,
  stepModel,
} from './strokes-geometry';

const [TL, TR, ML, MR, BL, BR] = [0, 1, 2, 3, 4, 5];
const N = 0,
  E = 90,
  S = 180,
  W = 270;

function hasHand(digit: number, cell: number, angle: number): boolean {
  const pair = DIGIT_FONT[digit][cell];
  return pair !== null && (pair[0] === angle || pair[1] === angle);
}

describe('buildLattice', () => {
  const cells = buildLattice();

  it('produces exactly 52 dials, all fully inside the disc', () => {
    expect(cells).toHaveLength(52);
    for (const c of cells) {
      expect(Math.hypot(c.cx - 500, c.cy - 500) + DIAL_R + 4).toBeLessThanOrEqual(496);
    }
  });

  it('is 4-fold symmetric', () => {
    const keys = new Set(cells.map((c) => `${c.col},${c.row}`));
    for (const c of cells) {
      expect(keys.has(`${-1 - c.col},${c.row}`)).toBe(true);
      expect(keys.has(`${c.col},${-1 - c.row}`)).toBe(true);
    }
  });

  it('contains the whole 4x6 core and is row-major ordered', () => {
    const keys = new Set(cells.map((c) => `${c.col},${c.row}`));
    for (let row = -3; row <= 2; row++)
      for (let col = -2; col <= 1; col++) expect(keys.has(`${col},${row}`)).toBe(true);
    const idx = (col: number, row: number) =>
      cells.findIndex((c) => c.col === col && c.row === row);
    expect(idx(-2, -3)).toBeLessThan(idx(-1, -3));
    expect(idx(1, -3)).toBeLessThan(idx(-2, -2));
  });
});

describe('DIGIT_FONT', () => {
  it('defines ten glyphs of six cells with orthogonal hands only', () => {
    expect(DIGIT_FONT).toHaveLength(10);
    for (const glyph of DIGIT_FONT) {
      expect(glyph).toHaveLength(6);
      for (const pair of glyph) {
        if (pair === null) continue;
        for (const a of pair) expect([N, E, S, W]).toContain(a);
      }
    }
  });

  it('holds the required tip-to-tip continuities per digit', () => {
    // [digit, cellA, angleA, cellB, angleB] — A's hand meets B's hand at the shared edge.
    const REQUIRED: Array<[number, number, number, number, number]> = [
      [0, TL, E, TR, W],
      [0, TL, S, ML, N],
      [0, ML, S, BL, N],
      [0, TR, S, MR, N],
      [0, MR, S, BR, N],
      [0, BL, E, BR, W],
      [1, TR, S, MR, N],
      [1, MR, S, BR, N],
      [2, TL, E, TR, W],
      [2, TR, S, MR, N],
      [2, MR, W, ML, E],
      [2, ML, S, BL, N],
      [2, BL, E, BR, W],
      [3, TL, E, TR, W],
      [3, TR, S, MR, N],
      [3, MR, S, BR, N],
      [3, BL, E, BR, W],
      [4, TL, S, ML, N],
      [4, TR, S, MR, N],
      [4, MR, S, BR, N],
      [5, TL, E, TR, W],
      [5, TL, S, ML, N],
      [5, ML, E, MR, W],
      [5, MR, S, BR, N],
      [5, BR, W, BL, E],
      [6, TL, E, TR, W],
      [6, TL, S, ML, N],
      [6, ML, S, BL, N],
      [6, MR, S, BR, N],
      [6, BL, E, BR, W],
      [7, TL, E, TR, W],
      [7, TR, S, MR, N],
      [7, MR, S, BR, N],
      [8, TL, E, TR, W],
      [8, TL, S, ML, N],
      [8, ML, E, MR, W],
      [8, TR, S, MR, N],
      [8, BL, E, BR, W],
      [9, TL, E, TR, W],
      [9, TL, S, ML, N],
      [9, TR, S, MR, N],
      [9, MR, S, BR, N],
      [9, BL, E, BR, W],
    ];
    for (const [d, cellA, aA, cellB, aB] of REQUIRED) {
      expect(hasHand(d, cellA, aA), `digit ${d} cell ${cellA} angle ${aA}`).toBe(true);
      expect(hasHand(d, cellB, aB), `digit ${d} cell ${cellB} angle ${aB}`).toBe(true);
    }
  });

  it('parks exactly the cells the glyphs leave empty', () => {
    expect(DIGIT_FONT[1][TL]).toBeNull();
    expect(DIGIT_FONT[1][ML]).toBeNull();
    expect(DIGIT_FONT[1][BL]).toBeNull();
    expect(DIGIT_FONT[4][BL]).toBeNull();
    expect(DIGIT_FONT[7][ML]).toBeNull();
    expect(DIGIT_FONT[7][BL]).toBeNull();
  });
});

describe('composeTargets', () => {
  it('24h 05:07 puts 0,5,0,7 in the four blocks', () => {
    const t = composeTargets(5, 7, '24');
    expect(t.size).toBe(24);
    expect(t.get('-2,-3')).toEqual(DIGIT_FONT[0][TL]); // HH tens = 0
    expect(t.get('0,-3')).toEqual(DIGIT_FONT[5][TL]); // HH ones = 5
    expect(t.get('-2,0')).toEqual(DIGIT_FONT[0][TL]); // MM tens = 0
    expect(t.get('1,2')).toEqual(DIGIT_FONT[7][BR]); // MM ones = 7
  });

  it('12h 17:05 blanks the hour-tens block and shows 5:05', () => {
    const t = composeTargets(17, 5, '12');
    for (let row = -3; row <= -1; row++)
      for (let col = -2; col <= -1; col++) expect(t.get(`${col},${row}`)).toBeNull();
    expect(t.get('0,-3')).toEqual(DIGIT_FONT[5][TL]);
  });

  it('midnight: 24h reads 00:00, 12h reads 12:00 with no blank block', () => {
    expect(composeTargets(0, 0, '24').get('-2,-3')).toEqual(DIGIT_FONT[0][TL]);
    const t12 = composeTargets(0, 0, '12');
    expect(t12.get('-2,-3')).toEqual(DIGIT_FONT[1][TL]);
    expect(t12.get('0,-3')).toEqual(DIGIT_FONT[2][TL]);
  });
});

describe('advanceClockwise', () => {
  it('always moves clockwise and never for an equal position', () => {
    expect(advanceClockwise(350, 10)).toBe(370);
    expect(advanceClockwise(10, 10)).toBe(10);
    expect(advanceClockwise(0, 270)).toBe(270);
    // Cumulative angles keep growing but an equal position stays put.
    expect(advanceClockwise(730, 10)).toBe(730);
  });
});

describe('stepModel', () => {
  const lattice = buildLattice();

  it('first model snaps (animate=false) and parks every field dial', () => {
    const m = stepModel(null, lattice, 15, 2, '24');
    expect(m.animate).toBe(false);
    expect(m.angles).toHaveLength(lattice.length * 2);
    lattice.forEach((c, i) => {
      const core = c.col >= -2 && c.col <= 1 && c.row >= -3 && c.row <= 2;
      if (!core) {
        expect(m.parked[i]).toBe(true);
        expect(m.angles[2 * i]).toBe(PARK_ANGLE);
        expect(m.angles[2 * i + 1]).toBe(PARK_ANGLE);
      }
    });
  });

  it('a +1 minute step animates and only moves hands whose target changed', () => {
    const a = stepModel(null, lattice, 15, 2, '24');
    const b = stepModel(a, lattice, 15, 3, '24');
    expect(b.animate).toBe(true);
    expect(b.moved.some(Boolean)).toBe(true);
    b.moved.forEach((mv, idx) => {
      if (!mv) expect(b.angles[idx]).toBe(a.angles[idx]);
      else expect(b.angles[idx]).toBeGreaterThan(a.angles[idx]);
    });
  });

  it('23:59 -> 00:00 wraps as a +1 step', () => {
    const a = stepModel(null, lattice, 23, 59, '24');
    const b = stepModel(a, lattice, 0, 0, '24');
    expect(b.animate).toBe(true);
  });

  it('multi-minute jumps and format changes snap', () => {
    const a = stepModel(null, lattice, 15, 2, '24');
    expect(stepModel(a, lattice, 15, 9, '24').animate).toBe(false);
    expect(stepModel(a, lattice, 15, 2, '12').animate).toBe(false);
  });

  it('delayRank ranks changed dials row-major from zero', () => {
    const a = stepModel(null, lattice, 15, 2, '24');
    const b = stepModel(a, lattice, 15, 3, '24');
    const ranks = b.delayRank.filter((_, idx) => b.moved[idx]);
    expect(Math.min(...ranks)).toBe(0);
  });
});
