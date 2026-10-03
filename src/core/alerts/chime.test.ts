import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CHIME_INTERVAL_MS, createChime, deviceHasAudio } from './chime';

class FakeContext {
  currentTime = 0;
  oscillators = 0;
  closed = false;
  destination = {};
  createOscillator() {
    this.oscillators += 1;
    return { type: '', frequency: { value: 0 }, connect: (n: unknown) => n, start() {}, stop() {} };
  }
  createGain() {
    const node = {
      gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
      connect: (n: unknown) => n,
    };
    return node;
  }
  close() {
    this.closed = true;
    return Promise.resolve();
  }
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('createChime', () => {
  it('plays two notes at once and repeats every interval until stopped', () => {
    const ctx = new FakeContext();
    const chime = createChime(() => ctx as unknown as AudioContext);
    chime.start();
    expect(ctx.oscillators).toBe(2);
    vi.advanceTimersByTime(CHIME_INTERVAL_MS);
    expect(ctx.oscillators).toBe(4);
    chime.stop();
    expect(ctx.closed).toBe(true);
    vi.advanceTimersByTime(CHIME_INTERVAL_MS * 3);
    expect(ctx.oscillators).toBe(4);
  });

  it('is silent, not broken, when no AudioContext can be made', () => {
    const chime = createChime(() => {
      throw new Error('no audio');
    });
    expect(() => chime.start()).not.toThrow();
    expect(() => chime.stop()).not.toThrow();
  });
});

describe('deviceHasAudio', () => {
  it('follows the device feature flags', () => {
    expect(deviceHasAudio('superclock-fast')).toBe(true);
    expect(deviceHasAudio('superclock-small')).toBe(false);
    expect(deviceHasAudio('superclock-square')).toBe(false);
    expect(deviceHasAudio(undefined)).toBe(false);
    expect(deviceHasAudio('not-a-device')).toBe(false);
  });
});
