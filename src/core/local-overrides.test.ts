import { describe, it, expect, beforeEach } from 'vitest';
import { useLocalOverrides, effectiveBrightness, effectiveNight } from './local-overrides';

beforeEach(() => {
  useLocalOverrides.setState({ brightness: null, night: null });
});

describe('brightness override', () => {
  it('no override → config value wins', () => {
    expect(effectiveBrightness(80)).toBe(80);
  });

  it('override wins over the config value it was set against', () => {
    useLocalOverrides.getState().setBrightness(40, 80); // user picks 40 while config says 80
    expect(effectiveBrightness(80)).toBe(40);
  });

  it('a NEW config value clears the override (admin wins)', () => {
    useLocalOverrides.getState().setBrightness(40, 80);
    expect(effectiveBrightness(60)).toBe(60); // config changed 80→60 → override dropped
    expect(useLocalOverrides.getState().brightness).toBeNull();
  });

  it('config becoming undefined (no baseline) drops the override', () => {
    useLocalOverrides.getState().setBrightness(40, 80);
    expect(effectiveBrightness(undefined)).toBeUndefined();
    expect(useLocalOverrides.getState().brightness).toBeNull();
  });

  it('repeated calls with an unchanged base keep the override alive', () => {
    useLocalOverrides.getState().setBrightness(40, 80);
    expect(effectiveBrightness(80)).toBe(40);
    expect(effectiveBrightness(80)).toBe(40);
    expect(useLocalOverrides.getState().brightness).not.toBeNull();
  });
});

describe('night override', () => {
  it('no override → scheduled value wins', () => {
    expect(effectiveNight(true)).toBe(true);
  });

  it('override wins until the schedule next flips', () => {
    useLocalOverrides.getState().setNight(true, false); // force night ON while schedule says day
    expect(effectiveNight(false)).toBe(true);
    // schedule flips to night on its own → override is spent, schedule resumes
    expect(effectiveNight(true)).toBe(true);
    expect(useLocalOverrides.getState().night).toBeNull();
  });
});
