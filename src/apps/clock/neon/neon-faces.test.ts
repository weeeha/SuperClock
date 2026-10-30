// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clockAngles } from '../../../core/hooks/useClockHands';
import { FACES } from '../../../shared/face-registry';
import { createKit, neonTime, renderFrame, type NeonFace } from './neon';
import tube from './faces/tube';
import sign from './faces/sign';
import nixie from './faces/nixie';
import plasma from './faces/plasma';
import horizon from './faces/horizon';

// No test can look at a neon face, so this holds what a look cannot: every
// face draws through 300 frames at five times of day without throwing,
// passes only finite numbers to the canvas, balances save/restore (a leak
// grows the state stack every frame for weeks on a Pi), and never touches the
// APIs the neon runtime exists to avoid. Layers are exercised too: jsdom has
// no canvas, so getContext returns the same recording fake.

const FACES_UNDER_TEST: NeonFace[] = [tube, sign, nixie, plasma, horizon];
const TIMES: Array<[number, number, number]> = [[0, 0, 0], [10, 9, 30], [12, 59, 59], [23, 58, 45], [6, 30, 15]];

interface Stats { depth: number; nonFinite: Set<string>; banned: Set<string> }

function fakeContext(stats: Stats, size: number): CanvasRenderingContext2D {
  const store: Record<string, unknown> = {
    lineWidth: 1, globalAlpha: 1, font: '10px sans-serif', globalCompositeOperation: 'source-over',
    strokeStyle: '#000', fillStyle: '#000', lineCap: 'butt', lineJoin: 'miter', textAlign: 'start',
    textBaseline: 'alphabetic', shadowBlur: 0, filter: 'none', canvas: { width: size, height: size },
  };
  const gradient = { addColorStop() {} };
  const numeric = new Set(['moveTo', 'lineTo', 'arc', 'arcTo', 'quadraticCurveTo', 'bezierCurveTo', 'rect', 'fillRect', 'strokeRect', 'clearRect', 'ellipse', 'fillText', 'strokeText', 'translate', 'rotate', 'scale', 'roundRect', 'setTransform', 'transform', 'drawImage']);
  const special: Record<string, (...a: unknown[]) => unknown> = {
    createRadialGradient: () => gradient,
    createLinearGradient: () => gradient,
    createConicGradient: () => gradient,
    measureText: (s) => ({ width: String(s).length * 6 }),
    getImageData: () => { stats.banned.add('getImageData'); return { data: new Uint8ClampedArray(4) }; },
    putImageData: () => { stats.banned.add('putImageData'); },
    save: () => { stats.depth++; },
    restore: () => { stats.depth--; },
  };
  return new Proxy({} as CanvasRenderingContext2D, {
    get(_, key: string) {
      if (key in special) return special[key];
      if (key in store) return store[key];
      return (...args: unknown[]) => {
        if (numeric.has(key)) for (const v of args) if (typeof v === 'number' && !Number.isFinite(v)) stats.nonFinite.add(key);
      };
    },
    set(_, key: string, value: unknown) {
      if (key === 'shadowBlur' && value) stats.banned.add('shadowBlur');
      if (key === 'filter' && value && value !== 'none') stats.banned.add('filter');
      if ((key === 'lineWidth' || key === 'globalAlpha') && !Number.isFinite(value)) stats.nonFinite.add(key);
      store[key] = value;
      return true;
    },
  });
}

let stats: Stats;
beforeEach(() => {
  stats = { depth: 0, nonFinite: new Set(), banned: new Set() };
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
    () => fakeContext(stats, 1080) as unknown as ReturnType<HTMLCanvasElement['getContext']>,
  );
});
afterEach(() => vi.restoreAllMocks());

describe('neon faces', () => {
  it.each(FACES_UNDER_TEST.map((f) => [f.id, f] as const))('%s draws cleanly through 300 frames', (_id, face) => {
    const ctx = fakeContext(stats, 1080);
    const kit = createKit(1);
    const state = {};
    let ambient = 0;
    for (const [h, m, s] of TIMES) {
      const base = new Date(2026, 9, 30, h, m, s).getTime();
      for (let f = 0; f < 60; f++) {
        ambient += 1 / 30;
        renderFrame(ctx, face, kit, state, neonTime(new Date(base + f * 33), ambient));
        expect(stats.depth, `save/restore unbalanced at ${h}:${m}:${s}`).toBe(0);
      }
    }
    expect([...stats.nonFinite], 'non-finite canvas arguments').toEqual([]);
    expect([...stats.banned], 'banned canvas APIs').toEqual([]);
  });

  it('draws in the soft glow too', () => {
    const ctx = fakeContext(stats, 1080);
    for (const face of FACES_UNDER_TEST) {
      renderFrame(ctx, face, createKit(0.35), {}, neonTime(new Date(2026, 9, 30, 22, 15, 5), 1));
    }
    expect(stats.depth).toBe(0);
  });

  it('every face module id is a registered face', () => {
    const ids = new Set(FACES.map((f) => f.id));
    for (const face of FACES_UNDER_TEST) expect(ids.has(face.id), face.id).toBe(true);
  });

  it('reads hand angles from clockAngles, the formulas useClockHands uses', () => {
    const d = new Date(2026, 9, 30, 10, 9, 30, 500);
    const T = neonTime(d, 0);
    expect(T.hourDeg).toBe(clockAngles(d).hourDeg);
    expect(T.minuteDeg).toBe(clockAngles(d).minuteDeg);
    expect(T.secondDeg).toBe(clockAngles(d).secondDeg);
    expect(T.sweepDeg).toBe(clockAngles(d, true).secondDeg);
  });
});
