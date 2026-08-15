import { describe, it, expect } from 'vitest';
import { withNewInstance } from './config-edits';
import { emptyDeviceConfig, type ScreenInstance } from '../src/shared/types';

const inst = (id: string): ScreenInstance => ({ id, appId: 'quote', config: {} });

describe('withNewInstance — create joins the rotation', () => {
  it('appends the instance AND its playlist entry (symmetric with DELETE)', () => {
    const cfg = emptyDeviceConfig('superclock-fast');
    const out = withNewInstance(cfg, inst('01A'));
    expect(out.instances.map((i) => i.id)).toEqual(['01A']);
    expect(out.playlist.items).toEqual(['01A']);
  });

  it('preserves existing playlist order and rotation setting', () => {
    const cfg = {
      ...emptyDeviceConfig('superclock-fast'),
      instances: [inst('01A')],
      playlist: { items: ['01A'], rotationSeconds: 30 },
    };
    const out = withNewInstance(cfg, inst('01B'));
    expect(out.playlist.items).toEqual(['01A', '01B']);
    expect(out.playlist.rotationSeconds).toBe(30);
  });

  it('does not mutate the input config', () => {
    const cfg = emptyDeviceConfig('superclock-fast');
    withNewInstance(cfg, inst('01A'));
    expect(cfg.instances).toEqual([]);
    expect(cfg.playlist.items).toEqual([]);
  });
});
