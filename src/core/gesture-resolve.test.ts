import { describe, it, expect } from 'vitest';
import { resolveDragEnd, SWIPE_THRESHOLD, SWIPE_VELOCITY } from './gesture-resolve';
import { ARC_MIN_TRAVEL } from './gesture-zones';

// Half of a 1080 disc — the peek denominator used by the live handler.
const SHEET = 540;
// A velocity comfortably past the swipe gate, so tests vary only distance/zone.
const V = SWIPE_VELOCITY + 0.2;

describe('resolveDragEnd — arc origins own their gesture (spec: one gesture, one outcome)', () => {
  it('sub-threshold bottom-arc swipe-up is a snap-back no-op, never an app vertical', () => {
    // 60px is past SWIPE_THRESHOLD (50) but short of ARC_MIN_TRAVEL (80): the
    // pre-fix bug fired the app's vertical callback here.
    expect(SWIPE_THRESHOLD).toBeLessThan(ARC_MIN_TRAVEL); // guards the gap exists
    const action = resolveDragEnd('bottom-arc', 'app', false, 0, -60, 0, V, SHEET);
    expect(action).toEqual({ type: 'none' });
  });

  it('sub-threshold top-arc swipe-down is a snap-back no-op', () => {
    const action = resolveDragEnd('top-arc', 'app', false, 0, 60, 0, V, SHEET);
    expect(action).toEqual({ type: 'none' });
  });

  it('sub-threshold left-arc swipe-right does not switch apps', () => {
    const action = resolveDragEnd('left-arc', 'app', false, 60, 0, V, 0, SHEET);
    expect(action).toEqual({ type: 'none' });
  });

  it('committed bottom-arc (past 40% travel) opens settings', () => {
    const action = resolveDragEnd('bottom-arc', 'app', false, 0, -0.5 * SHEET, 0, V, SHEET);
    expect(action).toEqual({ type: 'showSettings' });
  });

  it('bottom-arc past ARC_MIN_TRAVEL but under commit-progress snaps back', () => {
    // 120px clears ARC_MIN_TRAVEL (80) yet 120/540 = 0.22 < COMMIT_PROGRESS (0.4):
    // far enough to peek, not far enough to commit → snap-back no-op, no settings.
    const action = resolveDragEnd('bottom-arc', 'app', false, 0, -120, 0, V, SHEET);
    expect(action).toEqual({ type: 'none' });
  });

  it('committed top-arc opens the grid', () => {
    const action = resolveDragEnd('top-arc', 'app', false, 0, ARC_MIN_TRAVEL + 5, 0, V, SHEET);
    expect(action).toEqual({ type: 'showGrid' });
  });

  it('committed left-arc goes back', () => {
    const action = resolveDragEnd('left-arc', 'app', false, ARC_MIN_TRAVEL + 5, 0, V, 0, SHEET);
    expect(action).toEqual({ type: 'back' });
  });
});

describe('resolveDragEnd — grid dismissal reachable from any origin', () => {
  it('swipe-up from an ARC origin still closes the grid', () => {
    const action = resolveDragEnd('bottom-arc', 'grid', false, 0, -80, 0, V, SHEET);
    expect(action).toEqual({ type: 'hideGrid' });
  });

  it('swipe-up from an INNER origin still closes the grid', () => {
    const action = resolveDragEnd('inner', 'grid', false, 0, -80, 0, V, SHEET);
    expect(action).toEqual({ type: 'hideGrid' });
  });

  it('swipe-down in grid mode does nothing', () => {
    const action = resolveDragEnd('inner', 'grid', false, 0, 80, 0, V, SHEET);
    expect(action).toEqual({ type: 'none' });
  });
});

describe('resolveDragEnd — inner + right-arc origins reach app gestures', () => {
  it('inner vertical maps to an app-owned vertical action', () => {
    expect(resolveDragEnd('inner', 'app', false, 0, -80, 0, V, SHEET)).toEqual({ type: 'vertical', dir: 'up' });
    expect(resolveDragEnd('inner', 'app', false, 0, 80, 0, V, SHEET)).toEqual({ type: 'vertical', dir: 'down' });
  });

  it('unassigned right-arc origin falls through to app switching', () => {
    expect(resolveDragEnd('right-arc', 'app', false, -80, 0, V, 0, SHEET)).toEqual({ type: 'next' });
    expect(resolveDragEnd('right-arc', 'app', false, 80, 0, V, 0, SHEET)).toEqual({ type: 'prev' });
  });

  it('inner horizontal switches apps', () => {
    expect(resolveDragEnd('inner', 'app', false, -80, 0, V, 0, SHEET)).toEqual({ type: 'next' });
    expect(resolveDragEnd('inner', 'app', false, 80, 0, V, 0, SHEET)).toEqual({ type: 'prev' });
  });
});

describe('resolveDragEnd — settings-open only accepts dismissal', () => {
  it('swipe-down past threshold dismisses settings', () => {
    expect(resolveDragEnd('inner', 'app', true, 0, SWIPE_THRESHOLD + 10, 0, V, SHEET)).toEqual({ type: 'hideSettings' });
  });

  it('any other gesture while settings open is a no-op', () => {
    expect(resolveDragEnd('inner', 'app', true, -80, 0, V, 0, SHEET)).toEqual({ type: 'none' }); // horizontal
    expect(resolveDragEnd('inner', 'app', true, 0, -80, 0, V, SHEET)).toEqual({ type: 'none' });  // swipe-up
  });
});
