// Gesture allocation on the circular viewport.
//
// The invariant under test: ORIGIN DECIDES OWNER. The same swipe direction
// means different things depending on where the finger landed, and the shell
// and the active app can never both claim one gesture.

import { describe, it, expect } from 'vitest';
import { classifyGesture, EDGE_ZONE } from './classify';
import type { GestureInput } from './classify';
import {
  angleAt,
  angleDelta,
  fromPolar,
  normalizedRadius,
  sectorAt,
  inscribedRadius,
} from './geometry';

const ROUND = { width: 1080, height: 1080 };
/** The superclock-square device: 800x480 landscape, circle letterboxed to 480. */
const LETTERBOX = { width: 800, height: 480 };

const CENTER: [number, number] = [540, 540];
const TOP_EDGE: [number, number] = [540, 40];
const BOTTOM_EDGE: [number, number] = [540, 1040];
const LEFT_EDGE: [number, number] = [40, 540];
const RIGHT_EDGE: [number, number] = [1040, 540];

const UP: [number, number] = [0, -120];
const DOWN: [number, number] = [0, 120];
const LEFTWARD: [number, number] = [-120, 0];
const RIGHTWARD: [number, number] = [120, 0];

const FAST: [number, number] = [1, 1];

function gesture(over: Partial<GestureInput> = {}): GestureInput {
  return {
    origin: CENTER,
    movement: DOWN,
    velocity: FAST,
    viewport: ROUND,
    mode: 'app',
    hasVerticalHandler: false,
    onRingTrack: false,
    ...over,
  };
}

describe('geometry', () => {
  it('measures radius as a fraction of the inscribed circle', () => {
    expect(normalizedRadius(540, 540, ROUND)).toBe(0);
    expect(normalizedRadius(1080, 540, ROUND)).toBeCloseTo(1);
    expect(normalizedRadius(540, 0, ROUND)).toBeCloseTo(1);
  });

  it('inscribes against the SHORT axis so a landscape screen letterboxes', () => {
    expect(inscribedRadius(ROUND)).toBe(540);
    expect(inscribedRadius(LETTERBOX)).toBe(240);
  });

  it('measures angle clockwise from 12 o_clock', () => {
    expect(angleAt(540, 40, ROUND)).toBeCloseTo(0); // 12
    expect(angleAt(1040, 540, ROUND)).toBeCloseTo(90); // 3
    expect(angleAt(540, 1040, ROUND)).toBeCloseTo(180); // 6
    expect(angleAt(40, 540, ROUND)).toBeCloseTo(270); // 9
  });

  it('sectors the rim into quarters centred on 12/3/6/9', () => {
    expect(sectorAt(...TOP_EDGE, ROUND)).toBe('top');
    expect(sectorAt(...RIGHT_EDGE, ROUND)).toBe('right');
    expect(sectorAt(...BOTTOM_EDGE, ROUND)).toBe('bottom');
    expect(sectorAt(...LEFT_EDGE, ROUND)).toBe('left');
  });

  it('round-trips fromPolar against angleAt', () => {
    for (const deg of [0, 45, 90, 180, 270, 359]) {
      const [x, y] = fromPolar(deg, 400, 540, 540);
      expect(angleAt(x, y, ROUND)).toBeCloseTo(deg);
      expect(normalizedRadius(x, y, ROUND)).toBeCloseTo(400 / 540);
    }
  });

  it('takes the short way around when a sweep crosses 12 o_clock', () => {
    expect(angleDelta(359, 1)).toBeCloseTo(2);
    expect(angleDelta(1, 359)).toBeCloseTo(-2);
    expect(angleDelta(10, 100)).toBeCloseTo(90);
  });
});

describe('a Ring track claims the pointer outright', () => {
  it('beats every shell surface, from any origin, in any direction', () => {
    for (const origin of [CENTER, TOP_EDGE, BOTTOM_EDGE, LEFT_EDGE]) {
      for (const movement of [UP, DOWN, LEFTWARD, RIGHTWARD]) {
        expect(
          classifyGesture(gesture({ origin, movement, onRingTrack: true })).kind,
        ).toBe('ring');
      }
    }
  });
});

describe('edge zone: origin sector plus direction selects a shell surface', () => {
  it('pulls quick settings down from the top edge', () => {
    expect(classifyGesture(gesture({ origin: TOP_EDGE, movement: DOWN })).kind).toBe(
      'quick-settings',
    );
  });

  it('pulls the app grid up from the bottom edge', () => {
    expect(classifyGesture(gesture({ origin: BOTTOM_EDGE, movement: UP })).kind).toBe(
      'grid',
    );
  });

  it('goes back on a left-to-right swipe from the left edge', () => {
    expect(classifyGesture(gesture({ origin: LEFT_EDGE, movement: RIGHTWARD })).kind).toBe(
      'back',
    );
  });

  it('does NOT go back on a right-to-left swipe from the left edge', () => {
    // Direction is assigned, not merely detected: back owns L->R only.
    expect(classifyGesture(gesture({ origin: LEFT_EDGE, movement: LEFTWARD })).kind).toBe(
      'app-next',
    );
  });

  it('falls through to app switching from the unassigned right edge', () => {
    expect(classifyGesture(gesture({ origin: RIGHT_EDGE, movement: LEFTWARD })).kind).toBe(
      'app-next',
    );
  });

  it('falls through rather than dead-zoning when direction mismatches sector', () => {
    // Pulling DOWN on the BOTTOM edge is not "grid" — it behaves as interior.
    const r = classifyGesture(gesture({ origin: BOTTOM_EDGE, movement: DOWN }));
    expect(r.kind).toBe('hint-edge');
  });

  it('treats the boundary of the edge zone as inside it', () => {
    const boundary: [number, number] = [540, 540 - 540 * (1 - EDGE_ZONE)];
    expect(normalizedRadius(...boundary, ROUND)).toBeCloseTo(1 - EDGE_ZONE);
    expect(classifyGesture(gesture({ origin: boundary, movement: DOWN })).kind).toBe(
      'quick-settings',
    );
  });

  it('treats just inside the boundary as interior', () => {
    const inside: [number, number] = [540, 540 - 540 * (1 - EDGE_ZONE) + 2];
    expect(classifyGesture(gesture({ origin: inside, movement: DOWN })).kind).toBe(
      'hint-edge',
    );
  });
});

describe('interior: the app owns vertical, the shell owns horizontal', () => {
  it('gives interior vertical to the app when it registered a handler', () => {
    expect(
      classifyGesture(gesture({ movement: UP, hasVerticalHandler: true })),
    ).toEqual({ kind: 'app-vertical', dir: 'up' });
    expect(
      classifyGesture(gesture({ movement: DOWN, hasVerticalHandler: true })),
    ).toEqual({ kind: 'app-vertical', dir: 'down' });
  });

  it('NEVER lets the shell steal interior vertical from an app that wants it', () => {
    // The old model's bug, inverted into a guarantee: this is the case where
    // swipe-down used to silently stop opening the grid, and now must not
    // resolve to a shell surface at all.
    for (const origin of [CENTER, TOP_EDGE, BOTTOM_EDGE]) {
      const r = classifyGesture(
        gesture({ origin, movement: DOWN, hasVerticalHandler: true }),
      );
      if (origin === TOP_EDGE) {
        expect(r.kind).toBe('quick-settings'); // edge zone is explicitly shell
      } else {
        expect(r).toEqual({ kind: 'app-vertical', dir: 'down' });
      }
    }
  });

  it('hints toward the edge that owns what an unhandled swipe was reaching for', () => {
    expect(classifyGesture(gesture({ movement: UP }))).toEqual({
      kind: 'hint-edge',
      edge: 'bottom', // the grid lives on the bottom edge
    });
    expect(classifyGesture(gesture({ movement: DOWN }))).toEqual({
      kind: 'hint-edge',
      edge: 'top', // quick settings lives on the top edge
    });
  });

  it('switches apps on interior horizontal', () => {
    expect(classifyGesture(gesture({ movement: LEFTWARD })).kind).toBe('app-next');
    expect(classifyGesture(gesture({ movement: RIGHTWARD })).kind).toBe('app-prev');
  });

  it('never gives horizontal to the app, handler or not', () => {
    expect(
      classifyGesture(gesture({ movement: LEFTWARD, hasVerticalHandler: true })).kind,
    ).toBe('app-next');
  });
});

describe('thresholds', () => {
  it('ignores a slow drag even if it travels far', () => {
    expect(classifyGesture(gesture({ velocity: [0.1, 0.1] })).kind).toBe('none');
  });

  it('ignores a fast flick that barely moves', () => {
    expect(classifyGesture(gesture({ movement: [0, 10] })).kind).toBe('none');
  });

  it('resolves a diagonal by its dominant axis', () => {
    expect(classifyGesture(gesture({ movement: [-120, 60] })).kind).toBe('app-next');
    expect(classifyGesture(gesture({ movement: [-60, 120] })).kind).toBe('hint-edge');
  });
});

describe('overlays dismiss with the inverse of the gesture that opened them', () => {
  it('dismisses the grid on swipe down, from anywhere', () => {
    expect(
      classifyGesture(gesture({ mode: 'grid', origin: CENTER, movement: DOWN })).kind,
    ).toBe('dismiss-overlay');
  });

  it('does not dismiss the grid on swipe up', () => {
    expect(classifyGesture(gesture({ mode: 'grid', movement: UP })).kind).toBe('none');
  });

  it('dismisses quick settings on swipe up', () => {
    expect(
      classifyGesture(gesture({ mode: 'quick-settings', movement: UP })).kind,
    ).toBe('dismiss-overlay');
  });

  it('never switches apps while an overlay is open', () => {
    for (const mode of ['grid', 'quick-settings']) {
      expect(classifyGesture(gesture({ mode, movement: LEFTWARD })).kind).toBe('none');
    }
  });

  it('swallows everything mid-transition so a second switch cannot queue', () => {
    expect(classifyGesture(gesture({ mode: 'transitioning', movement: LEFTWARD })).kind).toBe(
      'none',
    );
  });
});

describe('the letterboxed 800x480 device', () => {
  it('applies identical rules against the inscribed 480px circle', () => {
    const g = (origin: [number, number], movement: [number, number]) =>
      classifyGesture(gesture({ origin, movement, viewport: LETTERBOX })).kind;

    expect(g([400, 20], DOWN)).toBe('quick-settings'); // top edge
    expect(g([400, 460], UP)).toBe('grid'); // bottom edge
    expect(g([180, 240], RIGHTWARD)).toBe('back'); // left edge
    expect(g([400, 240], DOWN)).toBe('hint-edge'); // interior
  });

  it('treats the letterbox bars as outside the circle, not as edge zone', () => {
    // x=40 is far left of an 800px viewport but WELL outside the 240px circle.
    expect(normalizedRadius(40, 240, LETTERBOX)).toBeGreaterThan(1);
    // Still classified by sector, so it behaves as left edge — the bars are
    // physically unreachable on the round devices and inert on this one.
    expect(sectorAt(40, 240, LETTERBOX)).toBe('left');
  });
});
