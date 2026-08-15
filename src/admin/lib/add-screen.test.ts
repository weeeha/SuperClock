// Spec-named coverage (P1 testing floor): Add-Screen creation defaults.
// Pure functions only — the AddScreenSheet component is a thin picker over
// listAddableScreens + buildNewInstance; navigation/mutation live in the
// component and are exercised in the Task 9 browser pass.

import { describe, it, expect } from 'vitest';
import { buildCapabilities } from '../../shared/capabilities';
import { FACES } from '../../shared/face-registry';
import { APP_ICONS } from '../../shared/app-icons';
import { defaultsFor } from '../../shared/schema-registry';
import { listAddableScreens, buildNewInstance, type AddableScreen } from './add-screen';

const kioskCaps = buildCapabilities('superclock-fast');

describe('listAddableScreens', () => {
  it('lists every registry face first, then apps — faces never interleave', () => {
    const entries = listAddableScreens(kioskCaps);
    const kinds = entries.map((e) => e.kind);
    const lastFace = kinds.lastIndexOf('face');
    const firstApp = kinds.indexOf('app');
    expect(lastFace).toBeGreaterThanOrEqual(0);
    expect(firstApp).toBeGreaterThan(lastFace);

    const faceIds = entries.filter((e) => e.kind === 'face').map((e) => e.faceId);
    expect(faceIds).toEqual(FACES.map((f) => f.id));
  });

  it('carries each face registry preview', () => {
    const faces = listAddableScreens(kioskCaps).filter((e) => e.kind === 'face');
    for (const face of faces) {
      const descriptor = FACES.find((f) => f.id === face.faceId);
      expect(face.preview).toBe(descriptor?.preview);
      expect(face.name).toBe(descriptor?.name);
    }
  });

  it('excludes clock from the app group (faces already represent it)', () => {
    const appIds = listAddableScreens(kioskCaps)
      .filter((e) => e.kind === 'app')
      .map((e) => e.appId);
    expect(appIds).not.toContain('clock');
    expect(appIds).toEqual(kioskCaps.apps.map((a) => a.id).filter((id) => id !== 'clock'));
  });

  it('resolves app icons from APP_ICONS, null when absent', () => {
    const apps = listAddableScreens(kioskCaps).filter((e) => e.kind === 'app');
    const habits = apps.find((e) => e.appId === 'habits');
    expect(habits?.icon).toBe(APP_ICONS['habits']);
    // breathing deliberately has no grid tile art — icon must be an honest null
    const breathing = apps.find((e) => e.appId === 'breathing');
    expect(breathing).toBeDefined();
    expect(breathing?.icon).toBeNull();
  });

  it('read-only slow device: faces still listed, app group empty (clock-only caps)', () => {
    const entries = listAddableScreens(buildCapabilities('superclock-slow'));
    expect(entries.filter((e) => e.kind === 'face').length).toBe(FACES.length);
    expect(entries.filter((e) => e.kind === 'app')).toEqual([]);
  });
});

describe('buildNewInstance', () => {
  it('face entry → clock instance with faceId + schema defaults under config.face', () => {
    const analog: AddableScreen = {
      kind: 'face',
      faceId: 'analog',
      name: 'Analog',
      preview: '/x.png',
    };
    const built = buildNewInstance(analog);
    expect(built.appId).toBe('clock');
    expect(built.label).toBe('Analog');
    expect(built.config.faceId).toBe('analog');
    // defaults come from the face schema, not an empty object
    const expected = defaultsFor('face.analog');
    expect(Object.keys(expected).length).toBeGreaterThan(0);
    expect(built.config.face).toEqual(expected);
  });

  it('face with no schema (minimalismo) → config.face = {}', () => {
    const built = buildNewInstance({
      kind: 'face',
      faceId: 'minimalismo',
      name: 'Minimalismo',
      preview: '/minimalismo-thumb.svg',
    });
    expect(built.appId).toBe('clock');
    expect(built.config).toEqual({ faceId: 'minimalismo', face: {} });
  });

  it('app entry → app instance with schema defaults as config, no label', () => {
    const built = buildNewInstance({ kind: 'app', appId: 'habits', name: 'Habits', icon: null });
    expect(built.appId).toBe('habits');
    expect(built.label).toBeUndefined();
    const expected = defaultsFor('app.habits');
    expect(Object.keys(expected).length).toBeGreaterThan(0);
    expect(built.config).toEqual(expected);
  });
});
