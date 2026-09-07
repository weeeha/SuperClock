// scripts/lib/parts-index.test.ts
import { describe, it, expect } from 'vitest';
import { firstSentence, partRow, emitIndex, collectMetaPaths, INDEX_COLUMNS, WIDGET_META_PATHS } from './parts-index.mjs';

const FACE = {
  kind: 'face',
  id: 'analog',
  purpose: 'The Swiss railway reference. It is the face the LVGL client mirrors.',
  accent: { where: 'seconds', color: 'config:accent' },
  night: { recipe: 'ignores night, legacy exempt face', tokens: [] },
  options: [],
  antiPatterns: [{ rule: 'x', why: 'y' }],
  parity: { lvgl: 'slow-native/src/clock_face.c' },
  spec: { space: 1000 },
};
const WIDGET = { kind: 'widget', id: 'round-list', purpose: 'A centre-column list, with a fade.', tokens: [], states: [], antiPatterns: [] };

describe('firstSentence', () => {
  it('cuts at the first sentence end and keeps the period', () => {
    expect(firstSentence(FACE.purpose)).toBe('The Swiss railway reference.');
  });
  it('returns the whole text when there is one sentence', () => {
    expect(firstSentence('One sentence only')).toBe('One sentence only');
  });
});

describe('partRow', () => {
  it('summarises a face: accent colour, parity, geometry state, first sentence', () => {
    expect(partRow(FACE, 'src/apps/clock/AnalogClock.meta.json')).toEqual({
      kind: 'face',
      id: 'analog',
      path: 'src/apps/clock/AnalogClock.meta.json',
      accent: 'config:accent',
      parity: 'lvgl',
      geometry: 'spec',
      purpose: 'The Swiss railway reference.',
    });
  });
  it('marks specless and pending faces, and dashes the face-only columns for widgets', () => {
    const { spec: _s, ...pending } = FACE;
    void _s;
    expect(partRow(pending, 'p').geometry).toBe('pending');
    expect(partRow({ ...pending, specless: 'a lattice' }, 'p').geometry).toBe('specless');
    expect(partRow({ ...pending, accent: null, parity: { lvgl: null } }, 'p')).toMatchObject({ accent: 'none', parity: 'none' });
    expect(partRow(WIDGET, 'w')).toMatchObject({ kind: 'widget', accent: '-', parity: '-', geometry: '-' });
  });
});

describe('emitIndex', () => {
  it('emits a TOON table sorted by kind then id, quoting fields that carry commas or quotes', () => {
    const rows = [partRow(WIDGET, 'w.json'), partRow(FACE, 'a.json')];
    const out = emitIndex(rows);
    expect(out.split('\n')[0]).toBe(`parts[2]{${INDEX_COLUMNS.join(',')}}:`);
    expect(out).toContain('  face,analog,a.json,config:accent,lvgl,spec,The Swiss railway reference.\n');
    expect(out).toContain('  widget,round-list,w.json,-,-,-,"A centre-column list, with a fade."\n');
    expect(out.indexOf('  face,')).toBeLessThan(out.indexOf('  widget,'));
    expect(out.endsWith('\n')).toBe(true);
  });
  it('is deterministic for the same rows in any order', () => {
    const a = emitIndex([partRow(WIDGET, 'w'), partRow(FACE, 'a')]);
    const b = emitIndex([partRow(FACE, 'a'), partRow(WIDGET, 'w')]);
    expect(a).toBe(b);
  });
});

describe('collectMetaPaths', () => {
  it('returns the clock metas from the glob plus the widget paths, sorted', () => {
    const paths = collectMetaPaths((p) => (p === 'src/apps/clock/*.meta.json' ? ['src/apps/clock/B.meta.json', 'src/apps/clock/A.meta.json'] : []));
    expect(paths).toEqual(['src/apps/clock/A.meta.json', 'src/apps/clock/B.meta.json', ...WIDGET_META_PATHS].sort());
  });
});
