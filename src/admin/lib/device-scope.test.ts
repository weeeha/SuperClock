// Spec-named coverage (P1 testing floor): legacy-route redirect map and
// useDeviceId resolution. Pure functions only — the hook and layout component
// are thin wrappers over resolveDeviceParam, which carries the logic.

import { describe, it, expect } from 'vitest';
import { ALL_DEVICE_IDS } from '../../shared/types';
import { LEGACY_REDIRECTS, resolveDeviceParam, deviceDisplayName } from './device-scope';

describe('resolveDeviceParam', () => {
  it('accepts every fleet device id', () => {
    for (const id of ALL_DEVICE_IDS) {
      expect(resolveDeviceParam(id)).toBe(id);
    }
  });

  it('rejects unknown and missing params', () => {
    expect(resolveDeviceParam('nope')).toBeNull();
    expect(resolveDeviceParam('')).toBeNull();
    expect(resolveDeviceParam(undefined)).toBeNull();
  });
});

describe('LEGACY_REDIRECTS', () => {
  it('maps exactly the old IA paths, all to Fleet Home', () => {
    expect(Object.keys(LEGACY_REDIRECTS).sort()).toEqual(['/apps', '/apps/*', '/playlist', '/settings']);
    for (const to of Object.values(LEGACY_REDIRECTS)) {
      expect(to).toBe('/');
    }
  });
});

describe('deviceDisplayName', () => {
  it('derives the human name from the device id', () => {
    expect(deviceDisplayName('superclock-fast')).toBe('Fast');
    expect(deviceDisplayName('superclock-square')).toBe('Square');
  });
});
