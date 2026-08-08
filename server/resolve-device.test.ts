import { describe, it, expect } from 'vitest';
import { resolveDeviceIdentity } from './resolve-device';

describe('resolveDeviceIdentity', () => {
  // The fleet's hostnames as actually provisioned (verified over SSH,
  // 2026-08-07). None of them is a verbatim DeviceId — this table is the
  // regression test for the "every Pi thinks it is superclock-fast" bug.
  it('resolves every real fleet hostname to its device', () => {
    const fleet = [
      ['SuperClockFast', 'superclock-fast'],
      ['SuperClock-Small', 'superclock-small'],
      ['superclok-square', 'superclock-square'],
    ] as const;
    for (const [hostname, id] of fleet) {
      expect(resolveDeviceIdentity(undefined, hostname).id).toBe(id);
    }
  });

  it('matches an exact device-id hostname', () => {
    expect(resolveDeviceIdentity(undefined, 'superclock-square')).toEqual({
      id: 'superclock-square',
      source: 'hostname',
    });
  });

  it('matches hostnames case-insensitively', () => {
    expect(resolveDeviceIdentity(undefined, 'SuperClock-Small')).toEqual({
      id: 'superclock-small',
      source: 'hostname',
    });
  });

  it('ignores a domain suffix', () => {
    expect(resolveDeviceIdentity(undefined, 'SuperClock-Small.local').id).toBe(
      'superclock-small',
    );
  });

  it('maps known hostname aliases (missing hyphen, provisioning typo)', () => {
    expect(resolveDeviceIdentity(undefined, 'SuperClockFast')).toEqual({
      id: 'superclock-fast',
      source: 'alias',
    });
    expect(resolveDeviceIdentity(undefined, 'superclok-square')).toEqual({
      id: 'superclock-square',
      source: 'alias',
    });
  });

  it('prefers env DEVICE_ID over the hostname', () => {
    expect(resolveDeviceIdentity('superclock-slow', 'superclock-fast')).toEqual({
      id: 'superclock-slow',
      source: 'env',
    });
  });

  it('normalizes env DEVICE_ID like a hostname', () => {
    expect(resolveDeviceIdentity('SuperClock-Small', 'nope').id).toBe(
      'superclock-small',
    );
  });

  it('falls through to the hostname when env DEVICE_ID is unrecognized', () => {
    expect(resolveDeviceIdentity('superclock-turbo', 'superclock-square')).toEqual({
      id: 'superclock-square',
      source: 'hostname',
    });
  });

  it('treats an empty env DEVICE_ID as unset', () => {
    expect(resolveDeviceIdentity('', 'superclock-small').source).toBe('hostname');
  });

  it('falls back to superclock-fast for unknown machines (dev)', () => {
    expect(resolveDeviceIdentity(undefined, 'Nicks-MacBook-Pro')).toEqual({
      id: 'superclock-fast',
      source: 'fallback',
    });
  });
});
