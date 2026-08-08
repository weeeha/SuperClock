// Pure geometry for the Composed Strokes face: dial lattice, digit font,
// time -> hand-target mapping, and the cumulative-angle step model.
// Spec: docs/superpowers/specs/2026-08-08-composed-strokes-face-design.md

export const PITCH = 110;
export const DIAL_R = 51;
export const HAND_LEN = 54;
export const PARK_ANGLE = 225;

const CENTER = 500;
const DISC_LIMIT = 496;

export type StrokesFormat = '24' | '12';
export type HandPair = readonly [number, number];

export interface Cell {
  col: number;
  row: number;
  cx: number;
  cy: number;
}

// A cell exists iff its dial (plus a 4-unit breathing margin) fits inside the
// disc. Row-major order so reading-order stagger falls out of the index.
export function buildLattice(): Cell[] {
  const cells: Cell[] = [];
  for (let row = -5; row <= 4; row++) {
    for (let col = -5; col <= 4; col++) {
      const cx = CENTER + (col + 0.5) * PITCH;
      const cy = CENTER + (row + 0.5) * PITCH;
      if (Math.hypot(cx - CENTER, cy - CENTER) + DIAL_R + 4 <= DISC_LIMIT) {
        cells.push({ col, row, cx, cy });
      }
    }
  }
  return cells;
}

// 6 cells per glyph: TL TR / ML MR / BL BR. Angles clockwise from north.
// null = parked. T-junctions are undrawable with two hands; digits 3/4/6/8/9
// carry a deliberate half-cell gap (the font's character — see spec).
export const DIGIT_FONT: ReadonlyArray<ReadonlyArray<HandPair | null>> = [
  /* 0 */ [[90, 180], [270, 180], [0, 180], [0, 180], [0, 90], [0, 270]],
  /* 1 */ [null, [180, 180], null, [0, 180], null, [0, 0]],
  /* 2 */ [[90, 90], [270, 180], [90, 180], [0, 270], [0, 90], [270, 270]],
  /* 3 */ [[90, 90], [270, 180], [90, 90], [0, 180], [90, 90], [0, 270]],
  /* 4 */ [[180, 180], [180, 180], [0, 90], [0, 180], null, [0, 0]],
  /* 5 */ [[90, 180], [270, 270], [0, 90], [270, 180], [90, 90], [0, 270]],
  /* 6 */ [[90, 180], [270, 270], [0, 180], [270, 180], [0, 90], [0, 270]],
  /* 7 */ [[90, 90], [270, 180], null, [0, 180], null, [0, 0]],
  /* 8 */ [[90, 180], [270, 180], [0, 90], [0, 270], [0, 90], [0, 270]],
  /* 9 */ [[90, 180], [270, 180], [0, 90], [0, 180], [90, 90], [0, 270]],
];

// Top-left lattice cell of each 2x3 digit block: HH tens, HH ones, MM tens, MM ones.
const DIGIT_BLOCKS = [
  { col: -2, row: -3 },
  { col: 0, row: -3 },
  { col: -2, row: 0 },
  { col: 0, row: 0 },
] as const;

export function composeTargets(
  hours: number,
  minutes: number,
  format: StrokesFormat,
): Map<string, HandPair | null> {
  let h = hours;
  let blankTens = false;
  if (format === '12') {
    h = hours % 12;
    if (h === 0) h = 12;
    blankTens = h < 10;
  }
  const digits = [Math.floor(h / 10), h % 10, Math.floor(minutes / 10), minutes % 10];
  const out = new Map<string, HandPair | null>();
  DIGIT_BLOCKS.forEach((block, i) => {
    const glyph = blankTens && i === 0 ? null : DIGIT_FONT[digits[i]];
    for (let cell = 0; cell < 6; cell++) {
      const col = block.col + (cell % 2);
      const row = block.row + Math.floor(cell / 2);
      out.set(`${col},${row}`, glyph ? glyph[cell] : null);
    }
  });
  return out;
}

// Cumulative clockwise advance: an equal position is a no-op, everything else
// travels the short clockwise way. Angles only ever grow.
export function advanceClockwise(prev: number, target: number): number {
  const delta = (((target - prev) % 360) + 360) % 360;
  return prev + delta;
}

export interface StrokesModel {
  key: string;
  minuteOfDay: number;
  format: StrokesFormat;
  /** cumulative degrees, 2 per lattice cell (index-aligned) */
  angles: number[];
  /** per lattice cell */
  parked: boolean[];
  /** 2 per cell — hand target changed this step */
  moved: boolean[];
  /** 2 per cell — row-major rank of the hand's dial among moved dials */
  delayRank: number[];
  animate: boolean;
}

export function stepModel(
  prev: StrokesModel | null,
  lattice: Cell[],
  hours: number,
  minutes: number,
  format: StrokesFormat,
): StrokesModel {
  const minuteOfDay = hours * 60 + minutes;
  const targets = composeTargets(hours, minutes, format);
  const animate =
    prev !== null &&
    prev.format === format &&
    (minuteOfDay - prev.minuteOfDay + 1440) % 1440 === 1;

  const angles: number[] = [];
  const parked: boolean[] = [];
  const moved: boolean[] = [];
  const delayRank: number[] = [];
  let rank = 0;

  lattice.forEach((cell, i) => {
    const pair = targets.get(`${cell.col},${cell.row}`) ?? null;
    parked.push(pair === null);
    let dialMoved = false;
    for (let j = 0; j < 2; j++) {
      const idx = 2 * i + j;
      const target = pair ? pair[j] : PARK_ANGLE;
      const next = prev ? advanceClockwise(prev.angles[idx], target) : target;
      angles.push(next);
      const didMove = prev !== null && next !== prev.angles[idx];
      moved.push(didMove);
      dialMoved = dialMoved || didMove;
    }
    const dialRank = dialMoved ? rank++ : 0;
    delayRank.push(dialRank, dialRank);
  });

  return {
    key: `${minuteOfDay}:${format}`,
    minuteOfDay,
    format,
    angles,
    parked,
    moved,
    delayRank,
    animate,
  };
}
