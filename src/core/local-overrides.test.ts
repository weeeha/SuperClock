import { describe, it, expect, beforeEach } from 'vitest';
import { useLocalOverrides, effectiveBrightness, effectiveNight } from './local-overrides';

beforeEach(() => {
  useLocalOverrides.setState({ brightness: null, night: null });
});

describe('effectiveBrightness (pure)', () => {
  it('no override → config value wins', () => {
    expect(effectiveBrightness(80, null)).toBe(80);
  });

  it('override wins over the config value it was set against', () => {
    expect(effectiveBrightness(80, { value: 40, base: 80 })).toBe(40);
  });

  it('a NEW config value returns the base (admin wins)', () => {
    // config moved 80→60; override was set against 80 → base resumes
    expect(effectiveBrightness(60, { value: 40, base: 80 })).toBe(60);
  });

  it('config becoming undefined (no baseline) returns undefined', () => {
    expect(effectiveBrightness(undefined, { value: 40, base: 80 })).toBeUndefined();
  });

  it('is idempotent — repeated resolution with an unchanged base is stable', () => {
    const o = { value: 40, base: 80 };
    expect(effectiveBrightness(80, o)).toBe(40);
    expect(effectiveBrightness(80, o)).toBe(40);
  });
});

describe('effectiveNight (pure)', () => {
  it('no override → scheduled value wins', () => {
    expect(effectiveNight(true, null)).toBe(true);
  });

  it('override wins over the scheduled value it was set against', () => {
    // force night ON while schedule says day
    expect(effectiveNight(false, { value: true, base: false })).toBe(true);
  });

  it('the schedule flipping returns the schedule (override spent)', () => {
    // schedule flips day→night; override was set against day → schedule resumes
    expect(effectiveNight(true, { value: true, base: false })).toBe(true);
  });

  it('is idempotent — repeated resolution with an unchanged base is stable', () => {
    const o = { value: true, base: false };
    expect(effectiveNight(false, o)).toBe(true);
    expect(effectiveNight(false, o)).toBe(true);
  });
});

describe('dropSpent', () => {
  it('clears only the brightness slice when its base changed', () => {
    useLocalOverrides.getState().setBrightness(40, 80);
    useLocalOverrides.getState().setNight(true, false);
    useLocalOverrides.getState().dropSpent(60, false); // brightness base 80→60, night base unchanged
    expect(useLocalOverrides.getState().brightness).toBeNull();
    expect(useLocalOverrides.getState().night).not.toBeNull();
  });

  it('clears only the night slice when its base changed', () => {
    useLocalOverrides.getState().setBrightness(40, 80);
    useLocalOverrides.getState().setNight(true, false);
    useLocalOverrides.getState().dropSpent(80, true); // night base false→true, brightness base unchanged
    expect(useLocalOverrides.getState().night).toBeNull();
    expect(useLocalOverrides.getState().brightness).not.toBeNull();
  });

  it('clears the brightness override when the baseline becomes undefined', () => {
    useLocalOverrides.getState().setBrightness(40, 80);
    useLocalOverrides.getState().dropSpent(undefined, false);
    expect(useLocalOverrides.getState().brightness).toBeNull();
  });

  it('is a state no-op when both bases still match (no store write)', () => {
    useLocalOverrides.getState().setBrightness(40, 80);
    useLocalOverrides.getState().setNight(true, false);
    const before = useLocalOverrides.getState();
    const brightnessRef = before.brightness;
    const nightRef = before.night;
    useLocalOverrides.getState().dropSpent(80, false); // both bases unchanged
    const after = useLocalOverrides.getState();
    // same object identities → no set() fired, so no needless re-render
    expect(after.brightness).toBe(brightnessRef);
    expect(after.night).toBe(nightRef);
  });

  it('is a no-op when there are no overrides to clear', () => {
    const before = useLocalOverrides.getState();
    useLocalOverrides.getState().dropSpent(60, true);
    expect(useLocalOverrides.getState()).toBe(before);
  });
});
