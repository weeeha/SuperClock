// Fixture tests for the part contract schema. Every rejection reason has a
// case, so a meta that fails the real-tree gate fails for a reason that was
// decided here, not for an accident of zod's defaults.
import { describe, it, expect } from 'vitest';
import {
  faceMetaSchema,
  widgetMetaSchema,
  partMetaSchema,
  resolveSpecColor,
  specOf,
  SPEC_PENDING,
} from './part-meta';

const SPEC = {
  space: 1000,
  radius: 500,
  face: { background: '--face-bg', ink: '--face-ink' },
  hands: {
    hour: { tip: 280, width: 28 },
    minute: { tip: 380, width: 20 },
    second: { tip: 350, tail: 80, width: 6, color: '#FFD700' },
  },
  ticks: null,
  dot: null,
};

const FACE = {
  kind: 'face',
  id: 'minimalismo',
  purpose: 'A bare white dial with two black hands and a gold sweeping second hand, nothing else.',
  accent: { where: 'the second hand', color: '#FFD700' },
  night: { recipe: 'Tokens flip bg and ink; the gold second hand stays gold.', tokens: ['--face-bg'] },
  options: [],
  antiPatterns: [{ rule: 'Do not add ticks', why: 'the face is defined by their absence' }],
  parity: { lvgl: null },
  spec: SPEC,
};

const WIDGET = {
  kind: 'widget',
  id: 'round-list',
  purpose: 'A centre-column vertical list for the round viewport, with an edge fade and a required empty state.',
  tokens: [],
  states: [{ state: 'empty', recipe: 'The empty node is rendered in place of the rows; it is a required prop.' }],
  antiPatterns: [{ rule: 'Do not render without an empty state', why: 'an empty list must say why it is empty' }],
};

describe('faceMetaSchema', () => {
  it('accepts a complete face meta', () => {
    expect(faceMetaSchema.safeParse(FACE).success).toBe(true);
  });

  it('rejects any string that begins with TODO, naming the reason', () => {
    const r = faceMetaSchema.safeParse({ ...FACE, purpose: 'TODO: write me and make it long enough' });
    expect(r.success).toBe(false);
    expect(r.error?.issues.some((i) => i.message.includes('TODO'))).toBe(true);
  });

  it('rejects spec and specless together', () => {
    const r = faceMetaSchema.safeParse({ ...FACE, specless: 'a lattice, no hands or ticks' });
    expect(r.success).toBe(false);
    expect(r.error?.issues.some((i) => i.message.includes('exclusive'))).toBe(true);
  });

  it('accepts a face with neither spec nor specless (the SPEC_PENDING case is decided by the gate)', () => {
    const { spec: _spec, ...pending } = FACE;
    void _spec;
    expect(faceMetaSchema.safeParse(pending).success).toBe(true);
  });

  it('rejects an LVGL parity claim without spec', () => {
    const { spec: _spec, ...noSpec } = FACE;
    void _spec;
    const r = faceMetaSchema.safeParse({ ...noSpec, parity: { lvgl: 'slow-native/src/clock_face.c' } });
    expect(r.success).toBe(false);
    expect(r.error?.issues.some((i) => i.message.includes('parity'))).toBe(true);
  });

  it('rejects a config: accent that names no option', () => {
    const r = faceMetaSchema.safeParse({ ...FACE, accent: { where: 'seconds', color: 'config:accent' } });
    expect(r.success).toBe(false);
    expect(r.error?.issues.some((i) => i.message.includes('config:accent'))).toBe(true);
  });

  it('accepts accent null for a face with no saturated quantity', () => {
    expect(faceMetaSchema.safeParse({ ...FACE, accent: null }).success).toBe(true);
  });

  it('rejects a colour that is neither a token, a #rrggbb literal, nor config:<key>', () => {
    const r = faceMetaSchema.safeParse({ ...FACE, accent: { where: 'seconds', color: 'gold' } });
    expect(r.success).toBe(false);
  });

  it('rejects a night token outside the --face-* family', () => {
    const r = faceMetaSchema.safeParse({ ...FACE, night: { ...FACE.night, tokens: ['--color-accent'] } });
    expect(r.success).toBe(false);
  });

  it('rejects an anti-pattern without a why', () => {
    const r = faceMetaSchema.safeParse({ ...FACE, antiPatterns: [{ rule: 'Do not add ticks', why: 'because' }] });
    expect(r.success).toBe(false);
  });

  it('rejects unknown fields (the file restates no props)', () => {
    const r = faceMetaSchema.safeParse({ ...FACE, category: 'classic' });
    expect(r.success).toBe(false);
  });

  it('rejects a tick whose outer edge is not beyond its inner edge', () => {
    const bad = { ...SPEC, ticks: { hour: { inner: 480, outer: 420, width: 12 }, minute: { inner: 435, outer: 460, width: 4 } } };
    expect(faceMetaSchema.safeParse({ ...FACE, spec: bad }).success).toBe(false);
  });
});

describe('widgetMetaSchema and partMetaSchema', () => {
  it('accepts a widget meta and routes it through partMetaSchema', () => {
    expect(widgetMetaSchema.safeParse(WIDGET).success).toBe(true);
    expect(partMetaSchema.safeParse(WIDGET).success).toBe(true);
    expect(partMetaSchema.safeParse(FACE).success).toBe(true);
  });

  it('rejects a widget with no states', () => {
    expect(widgetMetaSchema.safeParse({ ...WIDGET, states: [] }).success).toBe(false);
  });
});

describe('resolveSpecColor', () => {
  it('maps config:<key> to the option value, a token to var(), and passes literals through', () => {
    expect(resolveSpecColor('config:accent', { accent: '#FFD700' })).toBe('#FFD700');
    expect(resolveSpecColor('--face-ink', {})).toBe('var(--face-ink)');
    expect(resolveSpecColor('#000000', {})).toBe('#000000');
  });

  it('throws on a config: key the options do not carry', () => {
    expect(() => resolveSpecColor('config:missing', { accent: '#FFD700' })).toThrow('config:missing');
  });
});

describe('specOf', () => {
  it('returns the spec of a valid face meta', () => {
    expect(specOf(FACE, 'fixture').hands.hour.tip).toBe(280);
  });

  it('throws, naming the file, when the meta has no spec', () => {
    const { spec: _spec, ...noSpec } = FACE;
    void _spec;
    expect(() => specOf(noSpec, 'X.meta.json')).toThrow('X.meta.json');
  });
});

describe('SPEC_PENDING', () => {
  it('holds kebab face ids only', () => {
    for (const id of SPEC_PENDING) expect(id).toMatch(/^[a-z][a-z0-9-]*$/);
  });
});
