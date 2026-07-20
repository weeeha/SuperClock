// Cross-registry coherence — the app/face/schema lists live in several files
// that only agree by discipline. This test pins them together so adding an
// app or face in one place and forgetting another fails CI instead of
// shipping an app that's invisible in the admin (which happened: claude-usage
// was registered on the kiosk but missing from capabilities).

import { describe, it, expect } from 'vitest';
import '../apps'; // side-effect: registers every kiosk app
import { getAppIds } from '../core/registry';
import { FACE_COMPONENTS } from '../apps/clock/face-components';
import { FACES } from './face-registry';
import { SCHEMAS, defaultsFor } from './schema-registry';
import { buildCapabilities, STATIC_DEVICE_INFO } from './capabilities';
import { ALL_DEVICE_IDS } from './types';

// Faces that intentionally ship without a config schema.
const FACES_WITHOUT_SCHEMA = ['minimalismo'];
// Apps whose config is face-driven rather than a flat `app.<id>` schema.
const APPS_WITHOUT_SCHEMA = ['clock'];

describe('app registry ↔ capabilities', () => {
  const registeredIds = getAppIds();
  const fastCaps = buildCapabilities('superclock-fast');
  const capIds = fastCaps.apps.map((a) => a.id);

  it('every registered kiosk app is advertised in capabilities', () => {
    expect(capIds.sort()).toEqual([...registeredIds].sort());
  });

  it('every capabilities app id resolves to a registered app', () => {
    for (const id of capIds) {
      expect(registeredIds, `capabilities advertises unknown app '${id}'`).toContain(id);
    }
  });

  it('every non-clock app descriptor carries its config schema id', () => {
    for (const app of fastCaps.apps) {
      if (APPS_WITHOUT_SCHEMA.includes(app.id)) continue;
      expect(app.configSchemaId, `app '${app.id}' has no configSchemaId`).toBe(`app.${app.id}`);
      expect(SCHEMAS[`app.${app.id}`], `schema 'app.${app.id}' missing`).toBeDefined();
    }
  });

  it('every app.* schema belongs to a registered app', () => {
    for (const key of Object.keys(SCHEMAS)) {
      if (!key.startsWith('app.')) continue;
      const appId = key.slice('app.'.length);
      expect(registeredIds, `schema '${key}' has no registered app`).toContain(appId);
    }
  });
});

describe('face registry ↔ clock components ↔ schemas', () => {
  it('every face descriptor has a component and vice versa', () => {
    const faceIds = FACES.map((f) => f.id).sort();
    const componentIds = Object.keys(FACE_COMPONENTS).sort();
    expect(componentIds).toEqual(faceIds);
  });

  it('every face schema id resolves (minimalismo intentionally has none)', () => {
    for (const face of FACES) {
      if (FACES_WITHOUT_SCHEMA.includes(face.id)) {
        expect(face.configSchemaId).toBeUndefined();
        continue;
      }
      expect(face.configSchemaId, `face '${face.id}' has no configSchemaId`).toBe(
        `face.${face.id}`,
      );
      expect(SCHEMAS[`face.${face.id}`], `schema 'face.${face.id}' missing`).toBeDefined();
    }
  });
});

describe('schema registry', () => {
  it('defaultsFor() yields full defaults for every schema (admin seeds forms from this)', () => {
    for (const [id, entry] of Object.entries(SCHEMAS)) {
      const parsed = entry.schema.safeParse({});
      expect(parsed.success, `schema '${id}' cannot parse {} — a field lacks a default`).toBe(
        true,
      );
      expect(defaultsFor(id)).toEqual(parsed.success ? parsed.data : {});
    }
  });
});

describe('device info', () => {
  it('STATIC_DEVICE_INFO covers exactly ALL_DEVICE_IDS', () => {
    expect(Object.keys(STATIC_DEVICE_INFO).sort()).toEqual([...ALL_DEVICE_IDS].sort());
  });

  it('every supportedAppId on every device has a descriptor', () => {
    for (const id of ALL_DEVICE_IDS) {
      const caps = buildCapabilities(id);
      expect(caps.apps.length).toBe(STATIC_DEVICE_INFO[id].supportedAppIds.length);
    }
  });
});
