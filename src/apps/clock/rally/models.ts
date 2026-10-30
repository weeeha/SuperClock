// Low-poly models for the rally face, every one merged from primitives with
// vertex colours so a whole stretch of trees draws in one instanced call.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { CarId, PropGeo } from './worlds';

export const T = (x: number, y: number, z: number, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) =>
  new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));

function paint(geo: THREE.BufferGeometry, hex: string): THREE.BufferGeometry {
  const c = new THREE.Color(hex), n = geo.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++){ a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return geo;
}
export function part(geo: THREE.BufferGeometry, hex: string, m?: THREE.Matrix4): THREE.BufferGeometry {
  const g = geo.index ? geo.toNonIndexed() : geo;
  if (m) g.applyMatrix4(m);
  g.deleteAttribute('uv');
  return paint(g, hex);
}
export const cyl = (a: number, b: number, h: number, n: number) => new THREE.CylinderGeometry(a, b, h, n);
export const cone = (r: number, h: number, n: number) => new THREE.ConeGeometry(r, h, n);
export const box = (x: number, y: number, z: number) => new THREE.BoxGeometry(x, y, z);
export const ico = (r: number, d = 0) => new THREE.IcosahedronGeometry(r, d);
const merge = (parts: THREE.BufferGeometry[]) => mergeGeometries(parts);

function pineGeo(cols: [string, string, string], snow = false){
  const parts = [part(cyl(.2, .3, 1.4, 5), '#6b4a30', T(0, .7, 0))];
  ([[2, 2.8, 2.4], [1.55, 2.4, 3.6], [1, 2, 4.7]] as const).forEach(([r, h, y], i) => {
    parts.push(part(cone(r, h, 7), cols[i], T(0, y, 0, 0, i * .4, 0)));
    if (snow) parts.push(part(cone(r * .58, h * .58, 7), '#f4f7fa', T(0, y + h / 2 - (h * .58) / 2 + .03, 0, 0, i * .4, 0, 1.04, 1, 1.04)));
  });
  return merge(parts);
}
function houseGeo(wall: string, roof: string){
  const tri = new THREE.Shape([new THREE.Vector2(-2, 0), new THREE.Vector2(2, 0), new THREE.Vector2(0, 1.5)]);
  return merge([
    part(box(3.4, 2.2, 4.2), wall, T(0, 1.1, 0)),
    part(new THREE.ExtrudeGeometry(tri, { depth: 4.6, bevelEnabled: false }), roof, T(0, 2.2, -2.3)),
    part(box(.5, 1, .5), '#5a4a42', T(.9, 3.2, .8)),
    part(box(.9, 1.4, .06), '#3b2e28', T(0, .7, 2.12)),
  ]);
}
/** Unit box standing on the ground; the up-facing faces are the terracotta roof. */
function blockGeo(){
  const g = box(1, 1, 1).toNonIndexed(); g.translate(0, .5, 0); g.deleteAttribute('uv'); paint(g, '#e6dccb');
  const c = new THREE.Color('#b8573a'), col = g.attributes.color, nor = g.attributes.normal;
  for (let i = 0; i < col.count; i++) if (nor.getY(i) > .5) col.setXYZ(i, c.r, c.g, c.b);
  return g;
}
function palmGeo(){
  const parts = [part(cyl(.16, .26, 4.6, 6), '#7a5a3a', T(.15, 2.3, 0, 0, 0, -.07))];
  for (let i = 0; i < 7; i++){
    const m = new THREE.Matrix4().makeTranslation(.32, 4.6, 0)
      .multiply(new THREE.Matrix4().makeRotationY((i / 7) * Math.PI * 2))
      .multiply(new THREE.Matrix4().makeRotationX(.4))
      .multiply(new THREE.Matrix4().makeTranslation(0, 0, 1.5));
    parts.push(part(box(.55, .07, 3), i % 2 ? '#3f7a3a' : '#4d8c42', m));
  }
  return merge(parts);
}

/** Built once per scene; the scene disposes them with itself. */
export function buildProps(): Record<PropGeo | 'body' | 'head' | 'board', THREE.BufferGeometry> {
  return {
    pine: pineGeo(['#24583c', '#2c6a46', '#357a50']),
    pineDark: pineGeo(['#1f4636', '#285641', '#30654b']),
    snowpine: pineGeo(['#234f38', '#2b5f42', '#336d4b'], true),
    round: merge([part(cyl(.25, .35, 2.2, 5), '#6b4a30', T(0, 1.1, 0)), part(ico(1.9), '#5a9a40', T(0, 3.4, 0, 0, 0, 0, 1, .85, 1)), part(ico(1.25), '#6aab4b', T(.9, 4.2, .4))]),
    acacia: merge([part(cyl(.14, .24, 3.2, 5), '#5b4128', T(0, 1.6, 0, 0, 0, .12)), part(cyl(.08, .12, 1.6, 4), '#5b4128', T(-.6, 2.8, 0, 0, 0, .7)),
      part(cyl(3.2, 2.6, .55, 9), '#647a30', T(.2, 3.5, 0)), part(cyl(2, 1.7, .45, 8), '#7a9040', T(-.8, 3.95, .3))]),
    palm: palmGeo(),
    rock: part(new THREE.DodecahedronGeometry(1, 0), '#8d8d90', T(0, .35, 0, 0, 0, 0, 1, .7, 1)),
    houseRed: houseGeo('#b83a30', '#3a3a3e'), houseBlue: houseGeo('#2f5a96', '#3a3a3e'),
    houseWhite: houseGeo('#f1efe8', '#c2392f'), houseYellow: houseGeo('#e8c45a', '#5a3a30'),
    block: blockGeo(),
    bale: part(cyl(.8, .8, 1.3, 10), '#d8b24a', T(0, .8, 0, 0, 0, Math.PI / 2)),
    mound: part(cone(.9, 2.6, 6), '#a35f36', T(0, 1.2, 0)),
    tuft: part(cone(.28, 1.1, 3), '#c79a45', T(0, .5, 0)),
    flower: part(box(.32, .32, .32), '#ffffff', T(0, .2, 0)),
    grass: merge(([[0, 0, .25, '#4f9a32'], [.25, .1, -.3, '#5fae3c'], [-.2, .15, .35, '#478f2c'], [.05, -.25, -.15, '#6bbb44'], [-.1, -.05, 0, '#58a638']] as const)
      .map(([x, z, tilt, c]) => part(cone(.13, 1.1, 3), c, T(x, .5, z, tilt, 0, -tilt * .8)))),
    lupine: part(cone(.2, 1.1, 4), '#ffffff', T(0, .5, 0)),
    shrub: part(ico(.75), '#7d8a3e', T(0, .35, 0, 0, 0, 0, 1, .6, 1)),
    post: merge([part(box(.18, 1.1, .18), '#f4f4f0', T(0, .55, 0)), part(box(.2, .25, .2), '#202020', T(0, .85, 0))]),
    rail: merge([part(box(.16, .8, .16), '#c9c9c4', T(0, .4, 0)), part(box(.12, .28, 5.2), '#e2e2dc', T(.08, .62, 0))]),
    body: part(cyl(.28, .32, 1.1, 6), '#ffffff', T(0, .55, 0)),
    head: part(ico(.24, 1), '#e9c4a0', T(0, 1.35, 0)),
    board: merge([part(box(4, 1.1, .12), '#ffffff', T(0, 1.3, 0)), part(box(.12, 1.4, .12), '#333333', T(-1.8, .7, 0)), part(box(.12, 1.4, .12), '#333333', T(1.8, .7, 0))]),
  };
}

// ---------- cars: a recipe of primitives tagged with paint roles ----------

type Role = 'M' | 'A' | 'R' | 'G' | 'K' | 'L' | 'W';
type Part = [THREE.BufferGeometry, Role, THREE.Matrix4];
export interface CarModel { name: string; len: number; r: number; track: number; base: number; lampY: number; parts: () => Part[] }
export interface Livery { M: string; A: string; R: string }

const FIXED: Record<'G' | 'K' | 'L' | 'W', string> = { G: '#20262d', K: '#1b1b1d', L: '#fff4c2', W: '#f4f4f0' };

/** Square frustum: bottom wb by d, top shrinking to wt, so a cabin's glass slopes. */
function frustum(wb: number, wt: number, d: number, h: number){
  const g = new THREE.CylinderGeometry(wt / Math.SQRT2, wb / Math.SQRT2, h, 4, 1);
  g.rotateY(Math.PI / 4); g.scale(1, 1, d / wb);
  return g;
}

export const MODELS: Record<CarId, CarModel> = {
  hatch: { name: 'Hot hatch', len: 3.9, r: .38, track: .92, base: 1.25, lampY: .72, parts: () => [
    [box(1.9, .62, 3.9), 'M', T(0, .62, 0)], [frustum(1.7, 1.3, 2.1, .58), 'G', T(0, 1.22, .3)], [box(1.32, .07, 1.5), 'R', T(0, 1.54, .3)],
    [box(.55, .02, 1.4), 'A', T(0, .94, -1.15)], [box(1.8, .08, .4), 'M', T(0, 1.3, 1.85)], [box(1.92, .12, 3.92), 'A', T(0, .48, 0)]] },
  saloon: { name: 'Box saloon', len: 4.5, r: .38, track: .9, base: 1.45, lampY: .72, parts: () => [
    [box(1.85, .6, 4.5), 'M', T(0, .62, 0)], [frustum(1.7, 1.3, 2.0, .6), 'G', T(0, 1.22, .15)], [box(1.3, .07, 1.5), 'R', T(0, 1.55, .15)],
    [box(1.87, .1, 4.52), 'A', T(0, .76, 0)], [box(1.5, .28, .06), 'K', T(0, .6, -2.26)], [box(1.6, .06, .3), 'M', T(0, .95, 2.05)]] },
  wedge: { name: 'Wedge', len: 3.8, r: .38, track: .95, base: 1.2, lampY: .62, parts: () => [
    [box(2.0, .5, 3.8), 'M', T(0, .55, 0)], [frustum(1.8, 1.05, 1.9, .5), 'G', T(0, 1.05, .15)], [box(1.05, .06, 1.05), 'R', T(0, 1.32, .15)],
    [box(.9, .02, 3.82), 'A', T(0, .81, 0)], [box(2.05, .08, .55), 'A', T(0, 1.25, 1.75)], [box(.1, .45, .1), 'K', T(-.8, 1.0, 1.75)], [box(.1, .45, .1), 'K', T(.8, 1.0, 1.75)],
    [box(1.4, .26, .26), 'K', T(0, .92, -1.55)],
    ...[-.5, -.17, .17, .5].map((x): Part => [cyl(.11, .11, .04, 8), 'L', T(x, .92, -1.69, Math.PI / 2, 0, 0)])] },
  coupe: { name: 'Quattro coupe', len: 4.3, r: .4, track: .95, base: 1.35, lampY: .7, parts: () => [
    [box(1.85, .58, 4.3), 'M', T(0, .6, 0)],
    ...[[-1, -1.35], [1, -1.35], [-1, 1.35], [1, 1.35]].map(([x, z]): Part => [box(.26, .36, 1.15), 'M', T(x * .97, .66, z)]),
    [frustum(1.6, 1.22, 1.9, .55), 'G', T(0, 1.16, .35)], [box(1.22, .07, 1.35), 'R', T(0, 1.46, .35)], [box(1.9, .07, .45), 'A', T(0, 1.0, 2.0)], [box(1.88, .14, 4.32), 'A', T(0, .5, 0)]] },
  safari: { name: 'Safari 4x4', len: 4.4, r: .5, track: 1.0, base: 1.45, lampY: .98, parts: () => [
    [box(2.0, .9, 4.4), 'M', T(0, .98, 0)], [box(1.9, .72, 2.5), 'G', T(0, 1.78, .45)], [box(1.92, .08, 2.52), 'R', T(0, 2.18, .45)],
    [box(1.7, .1, 2.1), 'K', T(0, 2.3, .45)], [cyl(.45, .45, .28, 10), 'K', T(0, 2.5, .8)], [box(2.02, .16, 4.42), 'A', T(0, 1.15, 0)],
    [box(1.85, .42, .14), 'K', T(0, .78, -2.27)], [box(.14, 1.1, .14), 'K', T(1.02, 1.75, -1.0)], [box(.5, .5, .14), 'K', T(0, 1.45, 2.24)]] },
  mini: { name: 'Mini', len: 3.1, r: .32, track: .78, base: 1.0, lampY: .7, parts: () => [
    [box(1.6, .6, 3.1), 'M', T(0, .62, 0)], [frustum(1.5, 1.28, 1.8, .55), 'G', T(0, 1.19, .15)], [box(1.3, .07, 1.58), 'W', T(0, 1.5, .15)],
    [box(.16, .02, 1.0), 'A', T(-.2, .93, -1.0)], [box(.16, .02, 1.0), 'A', T(.2, .93, -1.0)], [box(1.62, .1, 3.12), 'W', T(0, .36, 0)]] },
  beetle: { name: 'Beetle', len: 3.9, r: .36, track: .82, base: 1.2, lampY: .7, parts: () => [
    [ico(1, 1), 'M', T(0, .72, 0, 0, 0, 0, .9, .62, 1.95)], [ico(1, 1), 'G', T(0, 1.05, .25, 0, 0, 0, .72, .55, .95)], [ico(1, 1), 'R', T(0, 1.16, .25, 0, 0, 0, .62, .48, .8)],
    ...[[-1, -1.2], [1, -1.2], [-1, 1.2], [1, 1.2]].map(([x, z]): Part => [ico(1, 1), 'M', T(x * .82, .55, z, 0, 0, 0, .3, .36, .58)]),
    [box(1.7, .12, .12), 'W', T(0, .45, -1.95)], [box(1.7, .12, .12), 'W', T(0, .45, 1.95)]] },
};

export const LIVERIES: Livery[] = [
  { M: '#d32f2a', A: '#f4f4f0', R: '#f4f4f0' }, { M: '#1f4fa8', A: '#f2c230', R: '#1f4fa8' }, { M: '#f4f4f0', A: '#1f3f8a', R: '#d32f2a' }, { M: '#2f7a4a', A: '#f4f4f0', R: '#2f7a4a' },
  { M: '#ef7d24', A: '#1b1b1d', R: '#1b1b1d' }, { M: '#f2c230', A: '#1b1b1d', R: '#f2c230' }, { M: '#1b1b1d', A: '#d8b25a', R: '#1b1b1d' }, { M: '#7fb7d8', A: '#f4f4f0', R: '#f4f4f0' },
];

export function carGeo(m: CarModel, liv: Livery): THREE.BufferGeometry {
  const colour = (role: Role) => (role === 'M' || role === 'A' || role === 'R' ? liv[role] : FIXED[role]);
  const parts = m.parts().map(([g, role, mat]) => part(g, colour(role), mat));
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]){
    parts.push(part(cyl(m.r, m.r, .32, 10), FIXED.K, T(x * m.track, m.r, z * m.base, 0, 0, Math.PI / 2)));
    parts.push(part(cyl(m.r * .45, m.r * .45, .34, 8), '#9a9ea3', T(x * m.track, m.r, z * m.base, 0, 0, Math.PI / 2)));
  }
  return merge(parts);
}
