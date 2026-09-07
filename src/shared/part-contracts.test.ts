// The contract gate: every face in FACE_COMPONENTS and every widget carries
// a .meta.json beside its component, the file validates, and every claim in
// it is true of the source. Same shape as registry-contract.test.ts: the
// judgments are prose, the facts around them cannot drift.
import { describe, it, expect } from 'vitest';
import { existsSync, globSync, readFileSync, readdirSync } from 'node:fs';
import { FACE_COMPONENTS } from '../apps/clock/face-components';
import { FACES } from './face-registry';
import { SCHEMAS } from './schema-registry';
import { faceMetaSchema, widgetMetaSchema, SPEC_PENDING } from './part-meta';
import type { FaceMeta, FaceSpec, WidgetMeta } from './part-meta';
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

// Finding 3: the import check below only proves a migrated face reads its
// meta once, at module scope; nothing stops a later edit from hardcoding a
// spec number straight back into the JSX and staying green. These three
// helpers detect that.

/** SVG attributes a hand-and-tick face actually writes numbers into: the
 *  x1/y1/x2/y2/cx/cy/r/strokeWidth a <line> or <circle> takes for a hand,
 *  tick, dot or the face radius. Deliberately an allowlist, not a denylist:
 *  Analog's numeral ring writes its own count and label as plain arguments
 *  (Array.from({ length: 12 }), i === 0 ? 12 : i) and its type size as
 *  fontSize/fontWeight, none of them in this list, so 12 (also a tick width
 *  and the dot's outer radius) and 500 (also the radius) are excluded by
 *  construction, not by naming every unrelated attribute that could
 *  coincidentally carry a spec number. */
const GEOMETRY_ATTRS = new Set(['x1', 'y1', 'x2', 'y2', 'cx', 'cy', 'r', 'strokeWidth']);

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

/** Every `attr="123"` or `attr={123}` in source whose attr is a geometry
 *  attribute and whose value is nothing but digits. An expression such as
 *  strokeWidth={width} or y2={C - tip} does not match: only a bare number
 *  does, which is what a reintroduced literal looks like. Comments are
 *  stripped first so a number mentioned in prose never counts. */
function bareGeometryLiterals(source: string): Array<{ name: string; value: number }> {
  const stripped = stripComments(source);
  const found: Array<{ name: string; value: number }> = [];
  for (const m of stripped.matchAll(/\b([A-Za-z][A-Za-z0-9]*)=(?:"(\d+)"|\{\s*(\d+)\s*\})/g)) {
    const name = m[1];
    const raw = m[2] ?? m[3];
    if (raw === undefined || !GEOMETRY_ATTRS.has(name)) continue;
    found.push({ name, value: Number(raw) });
  }
  return found;
}

/** Every numeric leaf spec carries, except space: space is always 1000 and
 *  is read as `${spec.space}` inside the viewBox template, never written as
 *  a bare literal by a correctly migrated face, so searching for it would
 *  only ever find a false alarm or nothing. */
function specLeafNumbers(spec: FaceSpec): Set<number> {
  const nums = [spec.radius, spec.hands.hour.tip, spec.hands.hour.width, spec.hands.minute.tip, spec.hands.minute.width];
  if (spec.hands.second) {
    nums.push(spec.hands.second.tip, spec.hands.second.width);
    if (spec.hands.second.tail !== undefined) nums.push(spec.hands.second.tail);
  }
  if (spec.ticks) {
    nums.push(spec.ticks.hour.inner, spec.ticks.hour.outer, spec.ticks.hour.width);
    nums.push(spec.ticks.minute.inner, spec.ticks.minute.outer, spec.ticks.minute.width);
  }
  if (spec.dot) {
    nums.push(spec.dot.outer, spec.dot.inner);
  }
  return new Set(nums);
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

  it('a face carrying spec has no hand, tick, dot or radius number hardcoded back into its TSX (the import check alone does not see a literal that returns)', () => {
    for (const part of faceParts) {
      const meta = loadFace(part);
      if (!meta.spec) continue;
      const nums = specLeafNumbers(meta.spec);
      const source = readFileSync(part.tsx, 'utf8');
      const literals = bareGeometryLiterals(source).filter((l) => nums.has(l.value));
      expect(
        literals,
        `${part.id}: ${part.tsx} hardcodes ${literals.map((l) => `${l.name}="${l.value}"`).join(', ')}, a number meta.spec already carries; read it from spec instead of a literal`,
      ).toEqual([]);
    }
  });
});

describe('widget contracts', () => {
  const widgets = WIDGET_META_PATHS.map((metaPath) => ({ metaPath, tsx: metaPath.replace(/\.meta\.json$/, '.tsx') }));

  function loadWidget(metaPath: string): WidgetMeta {
    return widgetMetaSchema.parse(JSON.parse(readFileSync(metaPath, 'utf8')));
  }

  // Finding 2: WIDGET_META_PATHS is a hand-kept literal (scripts/lib/parts-index.mjs),
  // not derived from a registry the way FACE_COMPONENTS drives the face half above.
  // A new widget file with no meta is invisible to every check that only iterates
  // `widgets`, including the index's own "lists every part once" test, which compares
  // against collectMetaPaths and is therefore circular for this exact gap.
  it('every component under src/core/widgets/ appears in WIDGET_META_PATHS (a new widget cannot dodge the gate by omission)', () => {
    const known = new Set(widgets.map((w) => w.tsx));
    for (const file of globSync('src/core/widgets/*.tsx')) {
      if (file.endsWith('.test.tsx')) continue;
      expect(
        known.has(file),
        `${file} has no entry in WIDGET_META_PATHS (scripts/lib/parts-index.mjs): add its meta path there and give it a .meta.json before this widget can pass the contract gate`,
      ).toBe(true);
    }
  });

  it('no meta file under src/core/widgets/ belongs to a widget that is not registered', () => {
    const known = new Set(WIDGET_META_PATHS);
    for (const file of readdirSync('src/core/widgets')) {
      if (!file.endsWith('.meta.json')) continue;
      const path = `src/core/widgets/${file}`;
      expect(known.has(path), `orphan contract ${path}: add it to WIDGET_META_PATHS in scripts/lib/parts-index.mjs`).toBe(true);
    }
  });

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
