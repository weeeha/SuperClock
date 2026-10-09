import { describe, it, expect } from 'vitest';
import { GUARD, initialGuard, stepGuard, type GuardState } from './frame-guard';

// Feed one sample per second at a steady fps, starting after the settle period.
function run(g: GuardState, fps: number, seconds: number, startAt: number, startFrame = 0) {
  let frame = startFrame;
  let at = startAt;
  for (let i = 0; i < seconds; i++) {
    g = stepGuard(g, { frame, idle: false }, at);
    frame += fps;
    at += 1000;
  }
  return { g, at, frame };
}

describe('frame guard', () => {
  it('stays at full while the page keeps up', () => {
    const { g } = run(initialGuard(0), 60, 30, 0);
    expect(g.level).toBe('full');
  });

  it('does not judge during the settle period after mount', () => {
    const { g } = run(initialGuard(0), 5, 9, 0);
    expect(g.level).toBe('full');
  });

  it('steps to half after a slow window, then to paused after another', () => {
    let r = run(initialGuard(0), 10, 17, 0);
    expect(r.g.level).toBe('half');
    r = run(r.g, 10, 17, r.at, r.frame);
    expect(r.g.level).toBe('paused');
  });

  it('never steps back up within a mount', () => {
    let r = run(initialGuard(0), 10, 17, 0);
    r = run(r.g, 60, 60, r.at, r.frame);
    expect(r.g.level).toBe('half');
  });

  it('ignores idle samples (paused, reduced motion, hidden) and restarts the window', () => {
    let g = initialGuard(0);
    let at = GUARD.settleMs;
    for (let i = 0; i < 30; i++) {
      g = stepGuard(g, { frame: 0, idle: true }, at);
      at += 1000;
    }
    expect(g.level).toBe('full');
    expect(g.fps).toEqual([]);
  });

  it('treats a frame counter that went backwards as a fresh baseline, not as slowness', () => {
    const r = run(initialGuard(0), 60, 12, 0, 10_000);
    r.g = stepGuard(r.g, { frame: 0, idle: false }, r.at);
    expect(r.g.level).toBe('full');
    expect(r.g.fps.every((f) => f >= 0)).toBe(true);
  });
});
