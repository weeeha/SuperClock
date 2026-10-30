// The rally face's 3D scene: an endless stage grown 60 m at a time ahead of a
// self-driving car, with weather and light blended over a few seconds.
// Loaded with a dynamic import from RallyClock, so three.js ships as its own
// chunk and only downloads when this face is on screen.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RALLY_WORLDS } from '../../../shared/schemas/face.rally';
import {
  BIOMES, CROWD, fbm, hash, hash2, lightForHour, mulberry, pick, roadX as roadXFor, smooth,
  type Biome, type CarId, type LightId, type PropSpec, type WeatherId, type WorldId,
} from './worlds';
import { LIVERIES, MODELS, box, buildProps, carGeo, ico, type CarModel, type Livery } from './models';

export interface RallyOptions {
  world: WorldId | 'auto';
  weather: WeatherId | 'auto';
  light: LightId | 'real' | 'cycle';
  car: CarId | 'auto';
  speedKmh: number;
  /** The kiosk's night palette is on: always drive at night. */
  night: boolean;
}

export interface RallyScene {
  setOptions(o: RallyOptions): void;
  /** Advance and draw one frame; a no-op while the canvas has no size. */
  frame(nowMs: number): void;
  dispose(): void;
}

const L = 60, HALF = 3.6, GW = 72, STEP = 3, SPREAD = 42;
const VIEW = { back: 30, h: 50, ahead: 9, fov: 30 };
const SHIFT_MS = 30_000, WORLD_MS = 600_000;
const RN = 1500, SN = 1200, DN = 300;
const ORDER: LightId[] = ['morning', 'noon', 'sunset', 'night'];

interface Cond {
  sunCol: THREE.Color; sunInt: number; sky: THREE.Color; gnd: THREE.Color; hemiInt: number;
  fog: THREE.Color; fogMul: number; road: THREE.Color; dir: THREE.Vector3;
  rain: number; snow: number; clouds: number; lights: number;
}
const C = (h: string) => new THREE.Color(h);
const mkCond = (): Cond => ({ sunCol: C('#ffffff'), sunInt: 2.6, sky: C('#ffffff'), gnd: C('#888888'), hemiInt: 1, fog: C('#ffffff'), fogMul: 1, road: C('#666666'),
  dir: new THREE.Vector3(-22, 38, -16), rain: 0, snow: 0, clouds: 0, lights: 0 });

const TIMES: Record<LightId, { dir: [number, number, number]; apply: (s: Cond) => void }> = {
  morning: { dir: [-36, 20, -4], apply: (s) => { s.sunCol.lerp(C('#ffcf98'), .65); s.sunInt *= .85; s.fog.lerp(C('#f2dcc4'), .3); } },
  noon: { dir: [-22, 38, -16], apply: () => {} },
  sunset: { dir: [38, 12, -10], apply: (s) => { s.sunCol.set('#ff9656'); s.sunInt *= .85; s.sky.lerp(C('#d9a3b8'), .5); s.hemiInt *= .7; s.fog.lerp(C('#e39f7c'), .45); } },
  night: { dir: [-16, 40, 12], apply: (s) => { s.sunCol.set('#8fa6ff'); s.sunInt = .28; s.sky.set('#2c3a5c'); s.gnd.set('#0e1220'); s.hemiInt = .5; s.fog.set('#121a29'); s.lights = 1; } },
};
const WEATHERS: Record<WeatherId, (s: Cond) => void> = {
  clear: () => {},
  clouds: (s) => { s.clouds = 1; s.sunInt *= .92; },
  rain: (s) => { s.clouds = 1; s.rain = 1; s.sunInt *= .42; s.hemiInt *= .85; s.fog.lerp(C('#7d8892'), .55); s.fogMul = .72; s.road.multiplyScalar(.5); s.lights = Math.max(s.lights, .5); },
  snow: (s) => { s.snow = 1; s.clouds = .5; s.sunInt *= .6; s.fog.lerp(C('#e4eaf0'), .55); s.fogMul = .75; s.road.lerp(C('#c9d0d6'), .4); },
};

export function createRallyScene(canvas: HTMLCanvasElement, initial: RallyOptions): RallyScene {
  let opts = initial;
  const rand = Math.random;
  const otherThan = <T,>(arr: readonly T[], cur: T) => { const o = arr.filter((x) => x !== cur); return pick(rand, o.length ? o : arr); };

  // ---------- renderer, camera, lights ----------
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(1); // a Pi kiosk runs for weeks; native pixels only
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.NeutralToneMapping;
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog('#ffffff', 55, 125);
  const fog = scene.fog as THREE.Fog;
  const background = new THREE.Color(); scene.background = background;
  const camera = new THREE.PerspectiveCamera(VIEW.fov, 1, 1, 500);
  const hemi = new THREE.HemisphereLight('#ffffff', '#888888', 1); scene.add(hemi);
  const sun = new THREE.DirectionalLight('#ffffff', 2.6); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -55, right: 55, top: 55, bottom: -55, near: 1, far: 160 });
  sun.shadow.bias = -.0004; sun.shadow.normalBias = .03;
  scene.add(sun, sun.target);

  const groundMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  const propMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  const roadMat = new THREE.MeshLambertMaterial({ color: '#666666' });
  const lineMat = new THREE.MeshLambertMaterial({ color: '#ffffff' });
  const trackMat = new THREE.MeshLambertMaterial({ color: '#888888' });
  const G = buildProps();

  // ---------- the world ----------
  let worldId: WorldId = opts.world === 'auto' ? pick(rand, RALLY_WORLDS) : opts.world;
  let B: Biome = BIOMES[worldId];
  const roadX = (s: number) => roadXFor(s, B.twist);
  const roadD = (s: number) => roadX(s + .5) - roadX(s - .5);
  const roadDD = (s: number) => roadX(s + 1) - 2 * roadX(s) + roadX(s - 1);
  const heading = (s: number) => Math.atan2(-roadD(s), 1);

  function groundH(x: number, s: number){
    if (!B.hill) return 0;
    const d = Math.abs(x - roadX(s));
    const m = B.offroad ? smooth(2.2, 11, d) : smooth(HALF + 1.5, HALF + 16, d);
    const n = fbm(x * (B.hillF ?? .03), s * (B.hillF ?? .03), 5);
    // ridged: sharp sand crests where the noise crosses its middle
    const h = B.ridged ? Math.pow(1 - Math.abs(2 * n - 1), 2) * B.hill - B.hill * .15 : n * B.hill - B.hill * .3;
    return h * m;
  }
  const gc = new THREE.Color(), c2 = new THREE.Color(), WHITE = C('#f4f7fa');
  function groundColor(x: number, s: number, h: number){
    gc.set(B.base).lerp(c2.set(B.patch), smooth(.45, .68, fbm(x * .06 + 100, s * .06, 9)));
    const [a, b] = B.patch2At ?? [.6, .8];
    gc.lerp(c2.set(B.patch2), smooth(a, b, fbm(x * .11, s * .11 + 50, 4)));
    if (B.ridged) gc.lerp(c2.set(B.patch2), smooth(B.hill * .3, B.hill * .75, h) * .8);
    if (B.snowLine != null) gc.lerp(WHITE, smooth(B.snowLine, B.snowLine + 2.5, h));
    if (!B.offroad && Math.abs(x - roadX(s)) < HALF + (B.shoulderW ?? 1.4)) gc.set(B.shoulder);
    gc.offsetHSL(0, 0, (hash2(Math.round(x * 7), Math.round(s * 7), 3) - .5) * .05);
    return gc;
  }
  function groundGeo(k: number){
    const nx = Math.round((2 * GW) / STEP) + 1, ns = Math.round(L / STEP) + 1;
    const pos = new Float32Array(nx * ns * 3), col = new Float32Array(nx * ns * 3), idx: number[] = [];
    for (let j = 0; j < ns; j++){
      const row = k * (ns - 1) + j, s = k * L + j * STEP;
      for (let q = 0; q < nx; q++){
        const x = -GW + q * STEP + (hash2(q, row, 1) - .5) * 1.6, h = groundH(x, s), i = j * nx + q;
        pos.set([x, h, -s], i * 3);
        const c = groundColor(x, s, h); col.set([c.r, c.g, c.b], i * 3);
        if (j < ns - 1 && q < nx - 1) idx.push(i, i + 1, i + nx + 1, i, i + nx + 1, i + nx);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setIndex(idx); g.computeVertexNormals();
    return g;
  }
  function ribbon(s0: number, s1: number, step: number, off: number, w: number, y: number){
    const ss: number[] = []; for (let s = s0; s <= s1 + 1e-6; s += step) ss.push(s);
    const pos = new Float32Array(ss.length * 6), idx: number[] = [];
    ss.forEach((s, j) => {
      const cx = roadX(s), d = roadD(s), len = Math.hypot(d, 1), nx = 1 / len, nz = d / len; // right-hand normal of (d, -1)
      const o1 = off - w / 2, o2 = off + w / 2;
      pos.set([cx + nx * o1, y, -s + nz * o1, cx + nx * o2, y, -s + nz * o2], j * 6);
      if (j < ss.length - 1){ const a = j * 2; idx.push(a, a + 1, a + 3, a, a + 3, a + 2); }
    });
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    return g;
  }

  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _ic = new THREE.Color();
  interface Item { x: number; y: number; s: number; sx: number; sy?: number; sz?: number; rx?: number; ry?: number; rz?: number; tint?: string; j?: number }
  function addInstances(g: THREE.Group, geo: THREE.BufferGeometry, list: Item[]){
    if (!list.length) return;
    const im = new THREE.InstancedMesh(geo, propMat, list.length);
    list.forEach((it, i) => {
      _p.set(it.x, it.y, -it.s); _q.setFromEuler(_e.set(it.rx ?? 0, it.ry ?? 0, it.rz ?? 0)); _s.set(it.sx, it.sy ?? it.sx, it.sz ?? it.sx);
      im.setMatrixAt(i, _m.compose(_p, _q, _s));
      _ic.set(it.tint ?? '#ffffff'); if (it.j) _ic.multiplyScalar(it.j); im.setColorAt(i, _ic);
    });
    im.castShadow = im.receiveShadow = true; g.add(im);
  }
  const range = (r: () => number, [a, b]: [number, number]) => a + r() * (b - a);
  function placeCrowd(k: number, rnd: () => number, count: number, g: THREE.Group){
    const bodies: Item[] = [], heads: Item[] = [], boards: Item[] = [];
    for (let c = 0; c < count; c++){
      const sc = k * L + rnd() * L, side = rnd() < .5 ? -1 : 1;
      for (let i = 0; i < 30; i++){
        const s = sc + (rnd() - .5) * 16, x = roadX(s) + side * (HALF + 2.4 + rnd() * 5), y = groundH(x, s), sz = .9 + rnd() * .25;
        bodies.push({ x, y, s, sx: sz, ry: rnd() * 6, tint: pick(rnd, CROWD) }); heads.push({ x, y, s, sx: sz });
      }
      for (let i = 0; i < 2; i++){
        const s = sc + (i - .5) * 9, x = roadX(s) + side * (HALF + 1.6);
        boards.push({ x, y: groundH(x, s), s, sx: 1, ry: heading(s) + Math.PI / 2, tint: pick(rnd, ['#2fbf7a', '#e0473a', '#f2c230']) });
      }
    }
    addInstances(g, G.body, bodies); addInstances(g, G.head, heads); addInstances(g, G.board, boards);
  }
  function placeProp(k: number, rnd: () => number, p: PropSpec, count: number, g: THREE.Group){
    const list: Item[] = [];
    if (p.type === 'posts'){
      const every = p.every ?? 12, gap = p.gap ?? 1.6;
      for (let s = Math.ceil((k * L) / every) * every; s < (k + 1) * L; s += every)
        for (const side of [-1, 1]){ const x = roadX(s) + side * (HALF + gap); list.push({ x, y: groundH(x, s), s, sx: 1, ry: p.align ? heading(s) : 0 }); }
      addInstances(g, G[p.geo ?? 'post'], list); return;
    }
    if (!p.geo) return;
    for (let i = 0; i < count; i++){
      const cs = k * L + rnd() * L, cx = roadX(cs) + (rnd() * 2 - 1) * SPREAD, m = p.cluster ?? 1;
      for (let j = 0; j < m; j++){
        const s = m > 1 ? cs + (rnd() - .5) * (p.radius ?? 3) * 2 : cs, x = m > 1 ? cx + (rnd() - .5) * (p.radius ?? 3) * 2 : cx;
        const it: Item = { x, y: groundH(x, s), s, sx: p.scale ? range(rnd, p.scale) : 1, ry: rnd() * Math.PI * 2, tint: p.tints ? pick(rnd, p.tints) : '#ffffff', j: .86 + rnd() * .28 };
        if (p.align) it.ry = heading(s) + (rnd() < .5 ? 0 : Math.PI / 2) + (rnd() - .5) * .12;
        if (p.box){ it.sx = range(rnd, p.box[0]); it.sy = range(rnd, p.box[1]); it.sz = range(rnd, p.box[2]); }
        if (p.tilt){ it.rx = (rnd() - .5) * p.tilt; it.rz = (rnd() - .5) * p.tilt; }
        if (Math.abs(x - roadX(s)) < HALF + (p.gap ?? 2)) continue;
        list.push(it);
      }
    }
    addInstances(g, G[p.geo], list);
  }
  function buildChunk(k: number){
    const g = new THREE.Group(), s0 = k * L, s1 = (k + 1) * L;
    const ground = new THREE.Mesh(groundGeo(k), groundMat); ground.receiveShadow = true; g.add(ground);
    if (!B.offroad){
      const road = new THREE.Mesh(ribbon(s0, s1, 1, 0, HALF * 2, .05), roadMat); road.receiveShadow = true; g.add(road);
      const lines: THREE.BufferGeometry[] = [];
      if (B.edge) lines.push(ribbon(s0, s1, 1, -HALF + .35, .18, .07), ribbon(s0, s1, 1, HALF - .35, .18, .07));
      if (B.lines) for (let s = Math.ceil(s0 / 5) * 5; s < s1; s += 5) lines.push(ribbon(s, s + 2.2, .55, 0, .16, .07));
      if (lines.length){ const m = new THREE.Mesh(mergeGeometries(lines), lineMat); m.receiveShadow = true; g.add(m); lines.forEach((l) => l.dispose()); }
    }
    if (B.tracks){
      // off road, two pairs of ruts: the line every car before this one took
      const ruts = B.offroad ? [-1.6, -.9, .9, 1.6] : [-1.1, 1.1];
      const parts = ruts.map((o) => ribbon(s0, s1, 1, o, B.offroad ? .4 : .55, .06));
      const m = new THREE.Mesh(mergeGeometries(parts), trackMat); m.receiveShadow = true; g.add(m); parts.forEach((p) => p.dispose());
    }
    const rnd = mulberry(hash(k, B.seed * 7919));
    for (const p of B.props){
      const count = Math.floor(p.n ?? 0) + (rnd() < (p.n ?? 0) % 1 ? 1 : 0);
      if (p.type === 'crowd') placeCrowd(k, rnd, count, g); else placeProp(k, rnd, p, count, g);
    }
    scene.add(g);
    return g;
  }
  function disposeChunk(g: THREE.Group){
    scene.remove(g);
    g.traverse((o) => {
      if (o instanceof THREE.InstancedMesh) o.dispose();
      else if (o instanceof THREE.Mesh) o.geometry.dispose(); // chunk-owned: ground, road, lines, ruts
    });
  }
  const chunks = new Map<number, THREE.Group>();
  function ensureChunks(s: number){
    const k0 = Math.floor(s / L);
    for (let k = k0 - 1; k <= k0 + 2; k++) if (!chunks.has(k)) chunks.set(k, buildChunk(k));
    for (const [k, g] of chunks) if (k < k0 - 1 || k > k0 + 2){ disposeChunk(g); chunks.delete(k); }
  }

  // ---------- the car ----------
  let carId: CarId = 'hatch', CAR: CarModel = MODELS.hatch, livery: Livery = LIVERIES[0];
  const car = new THREE.Mesh(carGeo(CAR, livery), propMat); car.castShadow = true; scene.add(car);
  const lampGeo = box(.36, .18, .05), tailGeo = box(.4, .16, .05);
  const lampMat = new THREE.MeshBasicMaterial({ color: '#fff4c2' }), tailMat = new THREE.MeshBasicMaterial({ color: '#ff2a1a' });
  const heads = [0, 1].map(() => new THREE.Mesh(lampGeo, lampMat)), tails = [0, 1].map(() => new THREE.Mesh(tailGeo, tailMat));
  car.add(...heads, ...tails);
  // headlights live in the scene at zero, so switching them on never recompiles a shader
  const beams = [0, 1].map(() => { const l = new THREE.SpotLight('#fff1d0', 0, 60, .42, .65, 1); car.add(l, l.target); return l; });
  function setCar(id: CarId){
    carId = id; CAR = MODELS[id]; livery = pick(rand, LIVERIES);
    car.geometry.dispose(); car.geometry = carGeo(CAR, livery);
    [-1, 1].forEach((sx, i) => {
      const x = sx * CAR.track * .65;
      heads[i].position.set(x, CAR.lampY, -CAR.len / 2 - .02); tails[i].position.set(x, CAR.lampY + .02, CAR.len / 2 + .02);
      beams[i].position.set(x, CAR.lampY + .15, -CAR.len / 2); beams[i].target.position.set(x * 3.5, 0, -26);
    });
  }
  const autoCar = () => setCar(otherThan(B.cars, carId));

  // ---------- dust: soft puffs, each fading on its own ----------
  const dustGeo = ico(.8, 1), aAlpha = new THREE.InstancedBufferAttribute(new Float32Array(DN), 1);
  aAlpha.setUsage(THREE.DynamicDrawUsage); dustGeo.setAttribute('aAlpha', aAlpha);
  const dustMat = new THREE.MeshLambertMaterial({ color: '#ffffff', transparent: true, depthWrite: false });
  dustMat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aAlpha;\nvarying float vAlpha;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvAlpha = aAlpha;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vAlpha;').replace('#include <dithering_fragment>', '#include <dithering_fragment>\ngl_FragColor.a *= vAlpha;');
  };
  const dust = new THREE.InstancedMesh(dustGeo, dustMat, DN); dust.count = 0; dust.frustumCulled = false; scene.add(dust);
  interface Puff { p: THREE.Vector3; v: THREE.Vector3; age: number; life: number; size: number }
  let puffs: Puff[] = []; let puffAcc = 0;
  const SPRAY = C('#cdd3d9'), SNOWC = C('#ffffff'), dc = new THREE.Color();

  // ---------- weather: rain streaks, snow flakes, cloud shadows ----------
  const rainPos = new Float32Array(RN * 6), drops = new Float32Array(RN * 3);
  const rainGeo = new THREE.BufferGeometry(); rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3).setUsage(THREE.DynamicDrawUsage));
  const rainMat = new THREE.LineBasicMaterial({ color: '#e4ebf2', transparent: true, opacity: 0 });
  const rain = new THREE.LineSegments(rainGeo, rainMat); rain.frustumCulled = false; scene.add(rain);
  const snowPos = new Float32Array(SN * 3);
  const snowGeo = new THREE.BufferGeometry(); snowGeo.setAttribute('position', new THREE.BufferAttribute(snowPos, 3).setUsage(THREE.DynamicDrawUsage));
  const flakeCanvas = document.createElement('canvas'); flakeCanvas.width = flakeCanvas.height = 32;
  { const x = flakeCanvas.getContext('2d'); if (x){ const g = x.createRadialGradient(16, 16, 0, 16, 16, 16);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.45, 'rgba(255,255,255,.85)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 32, 32); } }
  const flake = new THREE.CanvasTexture(flakeCanvas);
  const snowMat = new THREE.PointsMaterial({ map: flake, size: 1, transparent: true, opacity: 0, depthWrite: false });
  const snowFx = new THREE.Points(snowGeo, snowMat); snowFx.frustumCulled = false; scene.add(snowFx);
  const respawn = (arr: Float32Array, i: number, cx: number, cz: number, y0: number, y1: number) => {
    arr[i * 3] = cx + (rand() - .5) * 100; arr[i * 3 + 1] = y0 + rand() * (y1 - y0); arr[i * 3 + 2] = cz + (rand() - .5) * 100;
  };
  for (let i = 0; i < RN; i++) respawn(drops, i, 0, 0, 0, 55);
  for (let i = 0; i < SN; i++) respawn(snowPos, i, 0, 0, 0, 48);
  // invisible to the camera but drawn into the shadow map: their shadows cross the stage
  const cloudGeo = ico(1, 1), cloudMat = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });
  const clouds = Array.from({ length: 14 }, () => {
    const m = new THREE.Mesh(cloudGeo, cloudMat); m.castShadow = true; m.userData.r = 7 + rand() * 13;
    m.position.set((rand() - .5) * 160, 24 + rand() * 6, (rand() - .5) * 160); scene.add(m); return m;
  });

  // ---------- conditions: world x light x weather, eased toward a target ----------
  const cur = mkCond(), tgt = mkCond();
  let weatherNow: WeatherId = opts.weather === 'auto' ? pick(rand, B.weathers) : opts.weather;
  let cycleLight: LightId = 'noon';
  const lightNow = (): LightId => opts.night ? 'night' : opts.light === 'real' ? lightForHour(new Date().getHours()) : opts.light === 'cycle' ? cycleLight : opts.light;
  function computeTarget(){
    tgt.sunCol.set(B.sun[0]); tgt.sunInt = B.sun[1]; tgt.sky.set(B.hemi[0]); tgt.gnd.set(B.hemi[1]); tgt.hemiInt = B.hemi[2];
    tgt.fog.set(B.fog); tgt.fogMul = 1; tgt.road.set(B.road); tgt.rain = tgt.snow = tgt.clouds = tgt.lights = 0;
    const t = TIMES[lightNow()]; tgt.dir.set(...t.dir); t.apply(tgt); WEATHERS[weatherNow](tgt);
  }
  function applyCur(k: number){
    for (const key of ['sunCol', 'sky', 'gnd', 'fog', 'road'] as const) cur[key].lerp(tgt[key], k);
    for (const key of ['sunInt', 'hemiInt', 'fogMul', 'rain', 'snow', 'clouds', 'lights'] as const) cur[key] += (tgt[key] - cur[key]) * k;
    cur.dir.lerp(tgt.dir, k);
    sun.color.copy(cur.sunCol); sun.intensity = cur.sunInt; hemi.color.copy(cur.sky); hemi.groundColor.copy(cur.gnd); hemi.intensity = cur.hemiInt;
    fog.color.copy(cur.fog); background.copy(cur.fog); roadMat.color.copy(cur.road);
    beams.forEach((b) => (b.intensity = cur.lights * 45));
  }
  function setWorld(id: WorldId){
    worldId = id; B = BIOMES[id];
    for (const g of chunks.values()) disposeChunk(g);
    chunks.clear(); puffs = [];
    lineMat.color.set(B.lines ?? B.edge ?? '#ffffff'); trackMat.color.set(B.tracks ?? '#888888');
    if (opts.weather === 'auto' && !B.weathers.includes(weatherNow)) weatherNow = pick(rand, B.weathers);
    if (opts.car === 'auto') autoCar();
    computeTarget(); applyCur(1);
  }

  if (opts.car === 'auto') autoCar(); else setCar(opts.car);
  setWorld(worldId);

  // ---------- per frame ----------
  let s = 0, last = 0, camYaw = 0, vel = (opts.speedKmh / 3.6) * (B.pace ?? 1), size = 0, nextShift = 0, nextWorld = 0, shifts = 0;
  const carPos = new THREE.Vector3(), fwd = new THREE.Vector3(), look = new THREE.Vector3(), wheel = new THREE.Vector3(), back = new THREE.Vector3();

  function frame(now: number){
    const w = canvas.clientWidth;
    if (w === 0) return;
    if (w !== size){ size = w; renderer.setSize(w, w, false); }
    const dt = last ? Math.min(.1, Math.max(0, (now - last) / 1000)) : 0; last = now;
    if (!nextShift){ nextShift = now + SHIFT_MS; nextWorld = now + WORLD_MS; }

    if (now > nextShift){
      nextShift = now + SHIFT_MS; shifts++;
      if (opts.weather === 'auto') weatherNow = otherThan(B.weathers, weatherNow);
      if (opts.light === 'cycle') cycleLight = ORDER[(ORDER.indexOf(cycleLight) + 1) % ORDER.length];
      if (opts.car === 'auto' && shifts % 2 === 0) autoCar();
      computeTarget();
    }
    if (opts.world === 'auto' && now > nextWorld){ nextWorld = now + WORLD_MS; setWorld(otherThan(RALLY_WORLDS, worldId)); }
    applyCur(1 - Math.exp(-dt * .9));

    // brake for tight bends, accelerate out of them
    const bend = Math.min(1, Math.abs(roadDD(s + 12)) / .02);
    const want = (opts.speedKmh / 3.6) * (B.pace ?? 1) * (1 - .5 * bend);
    vel += (want - vel) * Math.min(1, dt * (want < vel ? 2.5 : 1.2));
    s += vel * dt;
    ensureChunks(s);

    const yaw = heading(s), slip = Math.max(-.32, Math.min(.32, -roadDD(s) * 11 * (vel / 38)));
    carPos.set(roadX(s), 0, -s); car.position.copy(carPos); car.position.y = Math.sin(now * .03) * .015;
    car.rotation.set(0, yaw + slip, -slip * .12);

    camYaw += (yaw - camYaw) * Math.min(1, dt * 2.2);
    fwd.set(-Math.sin(camYaw), 0, -Math.cos(camYaw));
    camera.position.copy(carPos).addScaledVector(fwd, -VIEW.back); camera.position.y = VIEW.h;
    const dist = Math.hypot(VIEW.back, VIEW.h), air = B.clearAir ?? 1;
    fog.near = dist * 1.05 * air * cur.fogMul; fog.far = dist * 2.6 * air * cur.fogMul;
    look.copy(carPos).addScaledVector(fwd, VIEW.ahead); camera.lookAt(look);
    sun.position.copy(carPos).add(cur.dir); sun.target.position.copy(carPos);

    // dust: heavier on loose ground and when the tail is out; spray in the wet, powder in snow
    let rate = B.dust[1] * (.35 + Math.abs(slip) * 2.5);
    dc.set(B.dust[0]);
    if (cur.rain > .3){ rate = Math.max(rate, .9); dc.lerp(SPRAY, cur.rain); }
    else if (cur.snow > .3){ rate = Math.max(rate, .8); dc.lerp(SNOWC, cur.snow); }
    dustMat.color.copy(dc);
    puffAcc += dt * vel * rate * .55;
    back.set(Math.sin(car.rotation.y), 0, Math.cos(car.rotation.y));
    while (puffAcc > 1){
      puffAcc--; if (puffs.length >= DN) break;
      const side = puffs.length % 2 ? -.95 : .95;
      wheel.set(side * CAR.track + (rand() - .5) * .3, .35, CAR.base + CAR.r * .8); car.localToWorld(wheel);
      puffs.push({ p: wheel.clone(), v: new THREE.Vector3(back.x * vel * .2 + (rand() - .5) * 3, .8 + rand() * 1.4, back.z * vel * .2 + (rand() - .5) * 3), age: 0, life: 2 + rand() * 1.8, size: .9 + rand() * .7 });
    }
    let n = 0;
    for (let i = puffs.length - 1; i >= 0; i--){
      const q = puffs[i]; q.age += dt;
      if (q.age > q.life){ puffs.splice(i, 1); continue; }
      q.v.multiplyScalar(1 - Math.min(1, dt * 1.8)); q.v.y += dt * .3; q.p.addScaledVector(q.v, dt);
      const t = q.age / q.life, sc = q.size * (.7 + t * 3.2);
      dust.setMatrixAt(n, _m.compose(q.p, _q.identity(), _s.set(sc, sc * .75, sc)));
      aAlpha.array[n] = .9 * Math.min(1, t * 6) * Math.pow(1 - t, 1.2); n++;
    }
    dust.count = n; dust.instanceMatrix.needsUpdate = true; aAlpha.needsUpdate = true;

    const nr = Math.round(RN * cur.rain);
    for (let i = 0; i < nr; i++){
      const j = i * 3; drops[j + 1] -= 52 * dt; drops[j] += 6 * dt;
      if (drops[j + 1] < 0 || Math.abs(drops[j + 2] - look.z) > 55 || Math.abs(drops[j] - look.x) > 55) respawn(drops, i, look.x, look.z, 5, 58);
      const x = drops[j], y = drops[j + 1], z = drops[j + 2];
      rainPos[i * 6] = x; rainPos[i * 6 + 1] = y; rainPos[i * 6 + 2] = z; rainPos[i * 6 + 3] = x - .18; rainPos[i * 6 + 4] = y + 1.7; rainPos[i * 6 + 5] = z;
    }
    rainGeo.setDrawRange(0, nr * 2); rainGeo.attributes.position.needsUpdate = nr > 0; rain.visible = nr > 0; rainMat.opacity = .55 * Math.min(1, cur.rain * 2);
    const ns = Math.round(SN * cur.snow);
    for (let i = 0; i < ns; i++){
      const j = i * 3; snowPos[j + 1] -= 5.5 * dt; snowPos[j] += (Math.sin(now * .0012 + i) * 1.6 + 1.5) * dt;
      if (snowPos[j + 1] < 0 || Math.abs(snowPos[j + 2] - look.z) > 55 || Math.abs(snowPos[j] - look.x) > 55) respawn(snowPos, i, look.x, look.z, 2, 46);
    }
    snowGeo.setDrawRange(0, ns); snowGeo.attributes.position.needsUpdate = ns > 0; snowFx.visible = ns > 0; snowMat.opacity = Math.min(1, cur.snow * 1.5);
    for (const m of clouds){
      m.position.x += 5 * dt; m.position.z -= 2 * dt;
      const dx = m.position.x - carPos.x, dz = m.position.z - carPos.z;
      if (dx > 80) m.position.x -= 160; else if (dx < -80) m.position.x += 160;
      if (dz > 80) m.position.z -= 160; else if (dz < -80) m.position.z += 160;
      const r = (m.userData.r as number) * cur.clouds; m.visible = r > .3; m.scale.set(r, r * .22, r * .8);
    }
    renderer.render(scene, camera);
  }

  return {
    setOptions(o){
      const prev = opts; opts = o;
      if (o.weather !== 'auto') weatherNow = o.weather;
      if (o.car !== prev.car){ if (o.car === 'auto') autoCar(); else setCar(o.car); }
      if (o.world !== prev.world && o.world !== 'auto') setWorld(o.world);
      else computeTarget();
    },
    frame,
    dispose(){
      for (const g of chunks.values()) disposeChunk(g);
      chunks.clear();
      Object.values(G).forEach((g) => g.dispose());
      [car.geometry, lampGeo, tailGeo, dustGeo, rainGeo, snowGeo, cloudGeo].forEach((g) => g.dispose());
      [groundMat, propMat, roadMat, lineMat, trackMat, lampMat, tailMat, dustMat, rainMat, snowMat, cloudMat].forEach((m) => m.dispose());
      flake.dispose(); dust.dispose();
      renderer.dispose(); renderer.forceContextLoss();
    },
  };
}
