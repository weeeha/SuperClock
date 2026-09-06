// Fixture tests for the C parser and the spec comparison. The parser is a
// regex over one file; these cases are what make it fail loudly instead of
// reporting clean when the initializer moves.
import { describe, it, expect } from 'vitest';
import { parseGeom, parseColors, compareToSpec, GEOM_FIELDS, PARITY_DRIFT_LEDGER } from './lvgl-parity.mjs';

const C_SNIPPET = `
#define COLOR_GOLD lv_color_hex(0xFFD700)
static geom_t scale_geom(int32_t viewport_px) {
    double s = viewport_px / 1000.0;
    geom_t g = {
        .center           = viewport_px / 2,
        .face_r           = (int32_t)(460 * s),
        .hour_fwd         = (int32_t)(280 * s),
        .min_fwd          = (int32_t)(380 * s),
        .sec_back         = (int32_t)( 80 * s),
        .sec_fwd          = (int32_t)(350 * s),
        .hour_w           = (int32_t)( 28 * s),
        .min_w            = (int32_t)( 20 * s),
        .sec_w            = (int32_t)(  6 * s),
        .hour_tick_outer  = (int32_t)(440 * s),
        .hour_tick_inner  = (int32_t)(380 * s),
        .min_tick_outer   = (int32_t)(420 * s),
        .min_tick_inner   = (int32_t)(395 * s),
        .hour_tick_w      = (int32_t)( 12 * s),
        .min_tick_w       = (int32_t)(  4 * s),
        .dot_outer        = (int32_t)( 24 * s),
        .dot_inner        = (int32_t)( 12 * s),
    };
    return g;
}
    lv_obj_set_style_bg_color(face, lv_color_white(), 0);
        lv_obj_set_style_line_color(tick, lv_color_black(), 0);
    s->hour = make_hand(parent, lv_color_black(), s->g.hour_w);
    s->min  = make_hand(parent, lv_color_black(), s->g.min_w);
    s->sec  = make_hand(parent, COLOR_GOLD,       s->g.sec_w);
    make_dot(parent, s->g.center, s->g.dot_outer, COLOR_GOLD);
    make_dot(parent, s->g.center, s->g.dot_inner, lv_color_black());
`;

const SPEC = {
  space: 1000,
  radius: 500,
  face: { background: '#000000', ink: '#ffffff' },
  hands: {
    hour: { tip: 280, width: 28 },
    minute: { tip: 380, width: 20 },
    second: { tip: 350, tail: 80, width: 6, color: 'config:accent' },
  },
  ticks: { hour: { inner: 420, outer: 480, width: 12 }, minute: { inner: 435, outer: 460, width: 4 } },
  dot: { outer: 12, inner: 6, outerColor: 'config:accent', innerColor: '#000000' },
};

describe('parseGeom', () => {
  it('reads every geom_t field out of the initializer', () => {
    const { geom, missing } = parseGeom(C_SNIPPET);
    expect(missing).toEqual([]);
    expect(geom.hour_fwd).toBe(280);
    expect(geom.dot_outer).toBe(24);
    expect(Object.keys(geom).sort()).toEqual([...GEOM_FIELDS].sort());
  });

  it('names the fields it could not find when the initializer moved (never reports clean)', () => {
    const { missing } = parseGeom(C_SNIPPET.replace('.hour_fwd         = (int32_t)(280 * s),', ''));
    expect(missing).toEqual(['hour_fwd']);
  });
});

describe('parseColors', () => {
  it('resolves lv_color_white/black, COLOR_* defines and lv_color_hex to #rrggbb', () => {
    const c = parseColors(C_SNIPPET);
    expect(c.face).toBe('#ffffff');
    expect(c.tick).toBe('#000000');
    expect(c.hands).toEqual({ hour: '#000000', min: '#000000', sec: '#ffd700' });
    expect(c.dots).toEqual({ outer: '#ffd700', inner: '#000000' });
  });

  it('returns null for a colour it cannot read, so the comparison reports it', () => {
    const c = parseColors(C_SNIPPET.replace('lv_obj_set_style_bg_color(face, lv_color_white(), 0);', ''));
    expect(c.face).toBeNull();
  });
});

describe('compareToSpec', () => {
  const { geom } = parseGeom(C_SNIPPET);
  const colors = parseColors(C_SNIPPET);
  const mismatches = compareToSpec(geom, colors, SPEC, { accent: '#FFD700' });
  const fields = mismatches.map((m) => m.field).sort();

  it('reports the known Analog drift and nothing else', () => {
    expect(fields).toEqual(
      ['face.background', 'face.ink', 'radius', 'ticks.hour.inner', 'ticks.hour.outer', 'ticks.minute.inner', 'ticks.minute.outer'].sort(),
    );
  });

  it('compares dot radii against C diameters and config colours against the option default', () => {
    expect(fields).not.toContain('dot.outer');
    expect(fields).not.toContain('hands.second.color');
    expect(fields).not.toContain('dot.outerColor');
  });

  it('carries both sides in each mismatch', () => {
    const r = mismatches.find((m) => m.field === 'radius');
    expect(r).toEqual({ field: 'radius', react: 500, lvgl: 460 });
  });

  it('reports a missing C colour as a mismatch against null', () => {
    const noFace = { ...colors, face: null };
    expect(compareToSpec(geom, noFace, SPEC, { accent: '#FFD700' }).find((m) => m.field === 'face.background')?.lvgl).toBeNull();
  });
});

describe('PARITY_DRIFT_LEDGER', () => {
  it('every entry names a field and a reason a reviewer can act on', () => {
    for (const e of PARITY_DRIFT_LEDGER) {
      expect(e.field).toMatch(/^[a-z][\w.]*$/);
      expect(e.reason.length, e.field).toBeGreaterThanOrEqual(30);
    }
  });
});
