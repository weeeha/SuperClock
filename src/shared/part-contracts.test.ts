// The contract gate: every face in FACE_COMPONENTS and every widget carries
// a .meta.json beside its component, the file validates, and every claim in
// it is true of the source. Same shape as registry-contract.test.ts: the
// judgments are prose, the facts around them cannot drift.
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { FACE_COMPONENTS } from '../apps/clock/face-components';
import { FACES } from './face-registry';
import { SCHEMAS } from './schema-registry';
import { faceMetaSchema, widgetMetaSchema, SPEC_PENDING } from './part-meta';
import type { FaceMeta, WidgetMeta } from './part-meta';
import { FACE_TOKEN_EXEMPT } from '../../scripts/lib/token-rules.mjs';
import { WIDGET_META_PATHS } from '../../scripts/lib/parts-index.mjs';

interface FacePart {
  id: string;
  name: string;
  tsx: string;
  metaPath: string;
}

const faceParts: FacePart[] = Object.entries(FACE_COMPONENTS).map(([id, component]) => {
  const name = component.name;
  return { id, name, tsx: `src/apps/clock/${name}.tsx`, metaPath: `src/apps/clock/${name}.meta.json` };
});

function readsToken(source: string, token: string): boolean {
  return source.includes(`(${token})`);
}

function loadFace(part: FacePart): FaceMeta {
  return faceMetaSchema.parse(JSON.parse(readFileSync(part.metaPath, 'utf8')));
}

function schemaKeys(id: string): string[] {
  const schemaId = FACES.find((f) => f.id === id)?.configSchemaId;
  if (!schemaId) return [];
  return Object.keys(SCHEMAS[schemaId].schema.shape).sort();
}

describe('face contracts', () => {
  it('maps every face to an existing component file (the meta path derives from it)', () => {
    for (const part of faceParts) {
      expect(existsSync(part.tsx), `${part.id}: ${part.tsx} does not exist; the meta path derivation is broken`).toBe(true);
    }
  });

  it('every face has a meta beside its component that validates, with kind face and its own id', () => {
    for (const part of faceParts) {
      expect(existsSync(part.metaPath), `${part.id}: missing ${part.metaPath}`).toBe(true);
      const meta = loadFace(part);
      expect(meta.kind).toBe('face');
      expect(meta.id, `${part.metaPath} names a different face`).toBe(part.id);
    }
  });

  it('no meta file under src/apps/clock belongs to a face that does not exist', () => {
    const known = new Set(faceParts.map((p) => p.metaPath));
    for (const file of readdirSync('src/apps/clock')) {
      if (!file.endsWith('.meta.json')) continue;
      expect(known.has(`src/apps/clock/${file}`), `orphan contract src/apps/clock/${file}`).toBe(true);
    }
  });

  it('every night token a face claims is read by its TSX, and a non-exempt face claims at least one', () => {
    for (const part of faceParts) {
      const meta = loadFace(part);
      const source = readFileSync(part.tsx, 'utf8');
      for (const token of meta.night.tokens) {
        expect(readsToken(source, token), `${part.id} claims ${token} but ${part.tsx} never reads (${token})`).toBe(true);
      }
      const exempt = FACE_TOKEN_EXEMPT.includes(`${part.name}.tsx`);
      if (!exempt) {
        expect(meta.night.tokens.length, `${part.id} is not night-exempt and claims no --face-* token`).toBeGreaterThan(0);
      }
    }
  });

  it('every option in a meta is a key of the face schema, and every schema key has an intent', () => {
    for (const part of faceParts) {
      const meta = loadFace(part);
      const declared = meta.options.map((o) => o.key).sort();
      expect(declared, `${part.id}: options differ from face schema keys`).toEqual(schemaKeys(part.id));
    }
  });

  it('a parity path, when claimed, exists', () => {
    for (const part of faceParts) {
      const meta = loadFace(part);
      if (meta.parity.lvgl) {
        expect(existsSync(meta.parity.lvgl), `${part.id}: parity file ${meta.parity.lvgl} missing`).toBe(true);
      }
    }
  });

  it('geometry state: spec or specless, unless the face is on SPEC_PENDING, which allows neither', () => {
    for (const part of faceParts) {
      const meta = loadFace(part);
      const pending = SPEC_PENDING.includes(part.id);
      const has = Boolean(meta.spec) || Boolean(meta.specless);
      if (pending) {
        expect(has, `${part.id} is on SPEC_PENDING but carries spec or specless: delete its SPEC_PENDING line`).toBe(false);
      } else {
        expect(has, `${part.id}: add spec (numbers) or specless (reason), or list it on SPEC_PENDING`).toBe(true);
      }
    }
  });

  it('SPEC_PENDING names faces that exist', () => {
    const ids = new Set(faceParts.map((p) => p.id));
    for (const id of SPEC_PENDING) expect(ids.has(id), `SPEC_PENDING names unknown face ${id}`).toBe(true);
  });

  it('a face carrying spec imports its meta (its numbers are read structurally)', () => {
    for (const part of faceParts) {
      const meta = loadFace(part);
      if (!meta.spec) continue;
      const source = readFileSync(part.tsx, 'utf8');
      expect(source.includes(`from './${part.name}.meta.json'`), `${part.tsx} carries spec but does not import ${part.name}.meta.json`).toBe(true);
      for (const token of [meta.spec.face.background, meta.spec.face.ink]) {
        if (token.startsWith('--')) {
          expect(readsToken(source, token), `${part.id}: spec names ${token} but the TSX never reads it`).toBe(true);
        }
      }
    }
  });
});

describe('widget contracts', () => {
  const widgets = WIDGET_META_PATHS.map((metaPath) => ({ metaPath, tsx: metaPath.replace(/\.meta\.json$/, '.tsx') }));

  function loadWidget(metaPath: string): WidgetMeta {
    return widgetMetaSchema.parse(JSON.parse(readFileSync(metaPath, 'utf8')));
  }

  it('every widget has a meta that validates beside an existing component', () => {
    for (const w of widgets) {
      expect(existsSync(w.tsx), `${w.tsx} missing`).toBe(true);
      expect(existsSync(w.metaPath), `${w.metaPath} missing`).toBe(true);
      expect(loadWidget(w.metaPath).kind).toBe('widget');
    }
  });

  it('every token a widget claims is read by its TSX', () => {
    for (const w of widgets) {
      const meta = loadWidget(w.metaPath);
      const source = readFileSync(w.tsx, 'utf8');
      for (const token of meta.tokens) {
        expect(readsToken(source, token), `${meta.id} claims ${token} but ${w.tsx} never reads it`).toBe(true);
      }
    }
  });

  it('insteadUse names existing parts, and ids are unique across faces and widgets', () => {
    const ids = [...faceParts.map((p) => p.id), ...widgets.map((w) => loadWidget(w.metaPath).id)];
    expect(new Set(ids).size, `duplicate part ids: ${ids.join(', ')}`).toBe(ids.length);
    for (const w of widgets) {
      for (const ref of loadWidget(w.metaPath).insteadUse ?? []) {
        expect(ids, `${w.metaPath}: insteadUse names unknown part ${ref}`).toContain(ref);
      }
    }
  });
});
