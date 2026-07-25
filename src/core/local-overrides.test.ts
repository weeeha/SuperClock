import { describe, it, expect, beforeEach } from 'vitest';
import { useLocalOverrides, effectiveBrightness, effectiveNight } from './local-overrides';

beforeEach(() => {
  useLocalOverrides.setState({
    brightness: null,
    night: null,
    bases: { brightness: undefined, night: false },
  });
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

  it('an override set against an undefined base survives repeated resolution', () => {
    // base undefined = "no config baseline / unfiltered"; the user still dimmed.
    // undefined === undefined keeps it alive across repeated resolves.
    const o = { value: 40, base: undefined };
    expect(effectiveBrightness(undefined, o)).toBe(40);
    expect(effectiveBrightness(undefined, o)).toBe(40);
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

describe('syncBases', () => {
  it('clears only the brightness slice when its base changed', () => {
    useLocalOverrides.getState().setBrightness(40, 80);
    useLocalOverrides.getState().setNight(true, false);
    useLocalOverrides.getState().syncBases(60, false); // brightness base 80→60, night base unchanged
    expect(useLocalOverrides.getState().brightness).toBeNull();
    expect(useLocalOverrides.getState().night).not.toBeNull();
  });

  it('clears only the night slice when its base changed', () => {
    useLocalOverrides.getState().setBrightness(40, 80);
    useLocalOverrides.getState().setNight(true, false);
    useLocalOverrides.getState().syncBases(80, true); // night base false→true, brightness base unchanged
    expect(useLocalOverrides.getState().night).toBeNull();
    expect(useLocalOverrides.getState().brightness).not.toBeNull();
  });

  it('clears the brightness override when the baseline becomes undefined', () => {
    useLocalOverrides.getState().setBrightness(40, 80);
    useLocalOverrides.getState().syncBases(undefined, false);
    expect(useLocalOverrides.getState().brightness).toBeNull();
  });

  it('records the passed bases so the sheet can read the live baseline', () => {
    useLocalOverrides.getState().syncBases(70, true);
    expect(useLocalOverrides.getState().bases).toEqual({ brightness: 70, night: true });
  });

  it('records an undefined brightness base (unfiltered config) verbatim', () => {
    useLocalOverrides.getState().syncBases(70, false); // seed a numeric base first
    useLocalOverrides.getState().syncBases(undefined, false);
    expect(useLocalOverrides.getState().bases).toEqual({ brightness: undefined, night: false });
  });

  it('is a state no-op when nothing is spent AND the bases are unchanged', () => {
    useLocalOverrides.getState().setBrightness(40, 80);
    useLocalOverrides.getState().setNight(true, false);
    useLocalOverrides.getState().syncBases(80, false); // records bases {80,false}
    const before = useLocalOverrides.getState();
    const brightnessRef = before.brightness;
    const nightRef = before.night;
    const basesRef = before.bases;
    useLocalOverrides.getState().syncBases(80, false); // both bases unchanged, nothing spent
    const after = useLocalOverrides.getState();
    // same object identities → no set() fired, so no needless re-render
    expect(after.brightness).toBe(brightnessRef);
    expect(after.night).toBe(nightRef);
    expect(after.bases).toBe(basesRef);
  });

  it('still writes (records bases) when a base changed but no override is spent', () => {
    // No overrides to clear, but the baseline moved → bases must update so the
    // sheet reflects it. This is NOT a no-op.
    useLocalOverrides.getState().syncBases(60, true);
    expect(useLocalOverrides.getState().bases).toEqual({ brightness: 60, night: true });
  });
});
