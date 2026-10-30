import type { NeonFace, NeonKit } from '../neon';
import { STAGE } from '../neon';

// Horizon: a neon night drive. A cyan-lined highway runs to a glowing horizon
// under a starfield; a city stands on the horizon with its windows lit and
// the striped sun climbing and setting behind it with the day (noon highest,
// night only a glow); an 80s wedge supercar weaves down the road ahead with
// orange tail lights that leave long-exposure trails and a faint reflection
// on the wet road; neon gates rush over the road toward you, a low-poly
// wireframe range stands at each end of the horizon, a shooting star crosses
// the sky now and then; the time hangs above it all in cyan tube digits.
//
// Still scenery (stars, the horizon glow, the city's windows, the fixed road
// lines and the digits) sits in cached layers; the sun, the dark city and
// road masks, the rolling floor, the lane dashes and the car draw live.

interface Star { x: number; y: number; r: number; a: number }
interface Building { x: number; w: number; h: number; antenna: boolean }
interface State { stars?: Star[]; city?: Building[]; peaks?: [number, number][][] }

const CX = 500;
const HZ = 560; // vanishing point and horizon line
const TAU = Math.PI * 2;

// The floor: a ground point at depth u (0 the horizon, 1 the viewer) sits at
// floorY(u); sideways offsets scale by spread(u) (1 at the bottom edge, y
// 1010); the floor rolls toward you at ROLL in u a second.
const ROLL = 1 / 9;
const floorY = (u: number) => HZ + 470 * u * u;
const spread = (u: number) => (470 * u * u) / (1010 - HZ);
const ROAD = 500; // road edges, sideways units at the bottom edge
const LANE = 165; // lane separators, halfway between the lane centres

// The car holds a fixed depth ahead of you. Its weave is a pure function of
// time, so where a tail light was d seconds ago is heroX(t - d), now d * ROLL
// closer: the trail needs no stored history and curves with the weave.
const CAR_U = 0.8; // the car's depth at cruising speed
const TAIL_WX = 102; // tail light centres from the car's middle, floor units (120 x HX)
const TAIL_WY = 78; // their height above the road, floor units

// Speed, in rungs a second, like a game's: long swells with quicker surges
// on top, from a near crawl (0.15) to almost double (1.85). Three sines with
// periods that never line up, so it never visibly repeats. travel() is its
// exact integral, the distance driven, and everything that moves (rungs,
// dashes, gates, palms, trails) reads travel(), so a dropped frame or a
// remount never makes the world jump.
// Neon Drive pace: a base of 2.2 rungs a second, swelling between 0.4x and
// 1.6x of it, always faster than the traffic.
const SPEED_BASE = 2.2;
const SPEEDS: ReadonlyArray<readonly [number, number, number]> = [
  [0.35, 19, 0], // amplitude (of the base), period in seconds, phase
  [0.15, 6.1, 1.7],
  [0.1, 41, 4.2],
];
const speed = (t: number) => SPEED_BASE * SPEEDS.reduce((v, [a, per, ph]) => v + a * Math.sin((TAU * t) / per + ph), 1);
const travel = (t: number) =>
  SPEED_BASE * SPEEDS.reduce((d, [a, per, ph]) => d - ((a * per) / TAU) * Math.cos((TAU * t) / per + ph), t);
const accel = (t: number) =>
  SPEED_BASE * SPEEDS.reduce((g, [a, per, ph]) => g + ((a * TAU) / per) * Math.cos((TAU * t) / per + ph), 0);
// The car pulls ahead when it is fast and drops back toward you when it brakes.
const carDepth = (t: number) => CAR_U - 0.05 * (speed(t) / SPEED_BASE - 1);

// Lanes, Neon Drive style: the car snaps between three lanes on the beat.
// The beat is the clock's own seconds (the face shifts its time so beats land
// on the ticks); a lane holds for a BLOCK of two beats, and each block picks
// its lane from a hash, so about two blocks in three bring a snap, sometimes
// across two lanes (a drift). Pure functions of time, like the speed.
// Lane centres -330, 0, 330. With both cars at HX width (hero 306 wide,
// sedan 280) neighbours keep a 37-unit gap, and the outer lane stays inside
// the disc at the car's depth.
const LANE_X = 330;
const BLOCK = 2;
const SNAP = 0.38; // seconds a snap takes
const h1 = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};
const laneOf = (b: number) => Math.floor(h1(b * 1.37 + 0.5) * 3) - 1;
const ease = (x: number) => {
  const u = Math.min(1, Math.max(0, x));
  return u * u * (3 - 2 * u);
};
/** The car's sideways position: snapping lane to lane, with a little life. */
const heroX = (t: number) => {
  const b = Math.floor(t / BLOCK);
  const from = laneOf(b - 1) * LANE_X;
  const to = laneOf(b) * LANE_X;
  return from + (to - from) * ease((t - b * BLOCK) / SNAP) + 10 * Math.sin(t * 2.3);
};
/** 0 to 1 while the car is in a two-lane snap: the drift. */
const driftOf = (t: number) => {
  const b = Math.floor(t / BLOCK);
  if (Math.abs(laneOf(b) - laneOf(b - 1)) < 2) return 0;
  const s = (t - b * BLOCK) / (SNAP * 2.2);
  return s < 1 ? Math.sin(Math.PI * s) : 0;
};

// Traffic, Electro Ride style: slower boxy sedans in the lanes. Each snap
// dodges one: a sedan sits in the lane the car is leaving and its tail passes
// the car's tail a second into the block, after the snap, and a second
// before the next one, so the car never steers into a sedan it just passed.
const TRAFFIC_V = 0.4; // rungs a second, under the car's slowest
interface Rival { u: number; X: number; id: number }
const trafficNow = (t: number, carU: number): Rival[] => {
  const out: Rival[] = [];
  const b0 = Math.floor(t / BLOCK);
  const dNow = travel(t);
  for (let b = b0 - 1; b <= b0 + 3; b++) {
    const from = laneOf(b - 1);
    if (from === laneOf(b)) continue;
    const tp = b * BLOCK + 1;
    const D = travel(tp) + TRAFFIC_V * (t - tp);
    const u = carU - (D - dNow) * ROLL;
    if (u > 0.03 && u < 1.08) out.push({ u, X: from * LANE_X, id: b });
  }
  return out;
};

// Palms: one every PALM_EVERY rungs on each side, outside the gates, rolling
// with the floor. A palm keeps its id as it rolls, so its height and lean
// (from N.hash(id)) stay its own.
const PALM_EVERY = 1.5;
const PALM_X = ROAD + 200;
interface Palm { u: number; id: number }
const palmSlots = (dist: number): Palm[] => {
  const k0 = Math.floor(dist / PALM_EVERY);
  const phase = dist / PALM_EVERY - k0;
  const out: Palm[] = [];
  for (let n = 0; n < 8; n++) out.push({ u: (n + phase) * PALM_EVERY * ROLL, id: k0 - n });
  return out;
};
const FRONDS = [-170, -142, -116, -90, -64, -38, -10].map((d) => (d * Math.PI) / 180);

function palms(ctx: CanvasRenderingContext2D, N: NeonKit, list: Palm[]) {
  const col = N.mix(N.c.magenta, N.c.violet, 0.35);
  for (const p of list) {
    if (p.u < 0.04 || p.u > 0.93) continue;
    const fade = Math.min(1, (p.u - 0.04) / 0.2) * Math.min(1, (0.93 - p.u) / 0.1);
    const sc = spread(p.u);
    const by = floorY(p.u);
    for (const side of [-1, 1]) {
      const h = N.hash(p.id * 2 + (side > 0 ? 1 : 0));
      const H = 380 + 90 * h;
      const lean = side * (30 + 50 * h);
      const bx = CX + side * (PALM_X + 60 * h) * sc;
      const tx = bx + lean * sc;
      const ty = by - H * sc;
      N.glow(ctx, col, 1.5 + 7 * sc, (c) => {
        // A trunk that bows outward, then the crown: fronds that arc up and droop.
        c.moveTo(bx, by);
        c.quadraticCurveTo(bx + lean * 0.15 * sc, by - H * 0.55 * sc, tx, ty);
        FRONDS.forEach((a, fi) => {
          const len = (150 + 40 * N.hash(p.id * 7 + fi + side)) * sc;
          const ang = a + (N.hash(p.id * 3 + fi) - 0.5) * 0.2;
          c.moveTo(tx, ty);
          c.quadraticCurveTo(
            tx + Math.cos(ang) * len * 0.5, ty + Math.sin(ang) * len * 0.5 - 40 * sc,
            tx + Math.cos(ang) * len, ty + Math.sin(ang) * len + 55 * sc,
          );
        });
      }, { intensity: 0.75 * fade, halo: 0.5 });
    }
  }
}

// Gates: one every GATE_S seconds, rolling with the floor, posts just outside
// the road edges. GATE_H is in floor units and below the eye height (450,
// where a gate's bar would sit on the horizon), so every bar stays on the
// road under the horizon, never across the skyline or the digits, and the car
// drives under them.
const GATE_S = 8;
const GATE_X = ROAD + 60;
const GATE_H = 300;

/** Gate depths now: one every GATE_S rungs of distance driven. */
const gateDepths = (dist: number) => {
  const phase = (((dist % GATE_S) + GATE_S) % GATE_S) / GATE_S;
  const step = GATE_S * ROLL;
  const out: number[] = [];
  for (let n = 0; n < 5; n++) out.push((n + phase) * step);
  return out;
};

function gates(ctx: CanvasRenderingContext2D, N: NeonKit, depths: number[]) {
  for (const u of depths) {
    if (u < 0.03 || u > 0.95) continue;
    const sc = spread(u);
    const base = floorY(u);
    const top = base - GATE_H * sc;
    const xl = CX - GATE_X * sc;
    const xr = CX + GATE_X * sc;
    // In from the horizon; out before the posts leave the disc, so a gate
    // never becomes a bare bar sweeping across the face.
    const fade = Math.min(1, (u - 0.03) / 0.2) * Math.min(1, (0.95 - u) / 0.1);
    N.glow(ctx, N.c.violet, 1.5 + 6 * u, (c) => {
      c.moveTo(xl, base);
      c.lineTo(xl, top);
      c.lineTo(xr, top);
      c.lineTo(xr, base);
    }, { intensity: 0.95 * fade, halo: 0.6 });
  }
}

function build(N: NeonKit, state: State) {
  const stars: Star[] = [];
  for (let i = 0; i < 150; i++) {
    const x = 40 + N.hash(i * 1.7) * 920;
    const y = 30 + N.hash(i * 2.9 + 4) * (HZ - 120);
    // Inside the disc only; the corners are bezel.
    if ((x - 500) ** 2 + (y - 500) ** 2 > 470 ** 2) continue;
    stars.push({ x, y, r: 0.8 + N.hash(i * 5.3) * 1.5, a: 0.2 + N.hash(i * 7.1) * 0.6 });
  }
  const city: Building[] = [];
  let x = 172;
  for (let i = 0; x < 828; i++) {
    const w = 24 + Math.floor(N.hash(i * 3.1) * 30);
    const mid = Math.abs(x + w / 2 - CX);
    // Taller toward the middle, low right at the vanishing point so the road
    // runs into light.
    let h = 40 + N.hash(i * 7.7) * 120 * (1 - (0.5 * mid) / 370);
    if (mid < 36) h = 16 + N.hash(i + 0.5) * 18;
    city.push({ x, w, h, antenna: h > 120 && N.hash(i * 13.3) > 0.45 });
    x += w + 2 + Math.floor(N.hash(i * 5.3) * 6);
  }
  state.stars = stars;
  state.city = city;
  // Two low-poly ranges at the ends of the horizon: a ridge of peaks, kept
  // inside the disc (at y 560 the disc spans x 27 to 973).
  const range = (x0: number, x1: number, seed: number): [number, number][] => {
    const pts: [number, number][] = [[x0, HZ]];
    const n = 7;
    for (let i = 1; i < n; i++) {
      const f = i / n;
      const px = x0 + (x1 - x0) * f + (N.hash(seed + i) - 0.5) * 8;
      // A tent: highest a third of the way in from the outer edge.
      const tall = Math.max(0.12, 1 - Math.abs(f - 0.4) * 1.9);
      pts.push([px, HZ - (12 + 72 * tall * (0.7 + 0.3 * N.hash(seed + i * 3.3)))]);
    }
    pts.push([x1, HZ]);
    return pts;
  };
  state.peaks = [range(30, 172, 11), range(970, 828, 29)];
}

function trails(ctx: CanvasRenderingContext2D, N: NeonKit, t: number, carU: number) {
  // Where a tail light was `age` seconds ago is now as much closer as the
  // road travelled since: travel(t) - travel(t - age). So the trail stretches
  // when the car is fast and shrinks to a stub when it crawls.
  const SEGS = 16;
  const STEPS = 3;
  const WINDOW = 4; // seconds of history at most
  const dNow = travel(t);
  const carS = spread(carU);
  for (let i = 0; i < SEGS; i++) {
    const f = i / SEGS;
    const age0 = f * WINDOW;
    const u0 = carU + (dNow - travel(t - age0)) * ROLL;
    if (u0 > 1.1) break;
    const ageMid = (f + 0.5 / SEGS) * WINDOW;
    const grow = spread(carU + (dNow - travel(t - ageMid)) * ROLL) / carS;
    // Hot orange at the car, cooling to pink as it streams away.
    N.glow(ctx, N.mix(N.c.orange, N.c.pink, f), 8 * grow, (c) => {
      for (const side of [-1, 1]) {
        for (let k = 0; k <= STEPS; k++) {
          const age = ((i + k / STEPS) / SEGS) * WINDOW;
          const u = carU + (dNow - travel(t - age)) * ROLL;
          const sc = spread(u);
          const px = CX + (heroX(t - age) + side * TAIL_WX) * sc;
          const py = floorY(u) - TAIL_WY * sc;
          if (k === 0) c.moveTo(px, py);
          else c.lineTo(px, py);
        }
      }
    }, { intensity: 1.05 * Math.pow(1 - f, 1.3), halo: 0.55, cap: 'butt' });
  }
}

// ---- The car, in 3D ----
//
// The floor is a pinhole camera 450 floor units above the road: a point at
// sideways X, height Y and depth Z projects to x = CX + X * F / Z,
// y = HZ + (450 - Y) * F / Z, which is exactly the floor's floorY/spread
// model with spread = F / Z. So the car is a small mesh in the same world,
// seen by the same camera: drift it left and you see its right flank, yaw it
// into a turn and the nose swings, and the roof and deck show from above.
const F = 800; // focal length in floor units
const CAM_Y = 450;
const PIVOT_Z = 380; // the car yaws about its middle (local units)
// The mesh is modelled low and long; seen from the floor camera it needs
// height to show its rear face and less length so the deck does not run to
// the horizon. These scale it into the world.
const HY = 1.35;
const LZ = 0.8;

type V3 = [number, number, number];
interface Pose { X: number; Z0: number; yaw: number; bob: number; hy: number; lz: number; hx: number }
// Both cars are modelled wide; this narrows them to fit two-car-wide lanes.
const HX = 0.85;
interface W3 { x: number; y: number; z: number }

const world = (p: V3, pose: Pose): W3 => {
  const [x, y, z] = p;
  const c = Math.cos(pose.yaw);
  const sn = Math.sin(pose.yaw);
  const zc = (z - PIVOT_Z) * pose.lz;
  const xs = x * pose.hx;
  return { x: pose.X + xs * c + zc * sn, y: y * pose.hy + pose.bob, z: pose.Z0 + PIVOT_Z * pose.lz - xs * sn + zc * c };
};
const screen = (q: W3, mirror = false): [number, number] => {
  const sc = F / q.z;
  return [CX + q.x * sc, HZ + (CAM_Y - (mirror ? -q.y : q.y)) * sc];
};
const sub = (a: W3, b: W3): W3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const dot = (a: W3, b: W3) => a.x * b.x + a.y * b.y + a.z * b.z;
const cross = (a: W3, b: W3): W3 => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });

// Local coordinates: x across (left negative), y up from the road, z forward
// from the rear bumper. A low 80s wedge: wide haunches, a flat deck, a small
// greenhouse set well forward, a nose that drops to the road.
const mirrorX = (v: V3): V3 => [-v[0], v[1], v[2]];
const B0: V3 = [-180, 18, 0]; // rear bottom
const B1: V3 = [-176, 84, 6]; // rear top
const B2: V3 = [-172, 84, 520]; // belt line at the windshield
const B3: V3 = [-160, 46, 740]; // nose top
const B4: V3 = [-160, 22, 760]; // nose bottom
const C0: V3 = [-122, 84, 280]; // cabin rear base, set forward: a long engine deck behind it
const C1: V3 = [-92, 128, 350]; // roof rear, low
const C2: V3 = [-88, 128, 470]; // roof front
const C3: V3 = [-130, 84, 560]; // windshield base
const R = mirrorX;

type Kind = 'side' | 'top' | 'rear' | 'glass' | 'hood';
interface Face { pts: V3[]; kind: Kind }
// Drawn in this order: from behind and above, later faces are always nearer.
const BODY_FACES: Face[] = [
  { pts: [B0, B1, B2, B3, B4], kind: 'side' },
  { pts: [R(B0), R(B1), R(B2), R(B3), R(B4)], kind: 'side' },
  { pts: [B2, R(B2), R(B3), B3], kind: 'hood' },
  { pts: [B1, R(B1), R(B2), B2], kind: 'top' },
  { pts: [C0, C1, C2, C3], kind: 'side' },
  { pts: [R(C0), R(C1), R(C2), R(C3)], kind: 'side' },
  { pts: [C0, R(C0), R(C1), C1], kind: 'glass' },
  { pts: [C1, R(C1), R(C2), C2], kind: 'top' },
  { pts: [B0, R(B0), R(B1), B1], kind: 'rear' },
];
const WING: V3[] = [[-178, 122, 4], [178, 122, 4], [178, 122, 60], [-178, 122, 60]];
const STRUTS: V3[][] = [[[-46, 84, 40], [-52, 122, 34]], [[46, 84, 40], [52, 122, 34]]];
// Engine-cover louvres across the deck between the wing and the cabin.
const LOUVRES: V3[][] = [100, 145, 190, 235].map((z) => [[-120, 84.5, z], [120, 84.5, z]]);
// On the rear face (it leans in 6 units over its 66 of height).
const onRear = (x: number, y: number): V3 => [x, y, ((y - 18) / 66) * 6];
const LIGHTS: V3[][] = [
  [onRear(-168, 46), onRear(-72, 46), onRear(-72, 70), onRear(-168, 70)],
  [onRear(72, 46), onRear(168, 46), onRear(168, 70), onRear(72, 70)],
];
const PLATE: V3[] = [onRear(-56, 44), onRear(56, 44), onRear(56, 64), onRear(-56, 64)];
const TYRE_BACKS: V3[][] = [
  [[-188, 0, 100], [-146, 0, 100], [-146, 34, 100], [-188, 34, 100]],
  [[146, 0, 100], [188, 0, 100], [188, 34, 100], [146, 34, 100]],
];
const CENTRE: V3 = [0, 60, 380];

const pathOf = (c: CanvasRenderingContext2D, pts: [number, number][]) => {
  c.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]);
  c.closePath();
};

/** Light from a gate passing over the car: 1 when a gate is right above it. */
const gateLight = (depths: number[], carU: number) =>
  depths.reduce((m, u) => Math.max(m, Math.exp(-(((u - carU) / 0.07) ** 2))), 0);

/** lit: a gate overhead (0 to 1). brake and boost: how hard the car is
 *  slowing or speeding up (0 to 1), for the brake lights and exhaust flames. */
function car(ctx: CanvasRenderingContext2D, N: NeonKit, t: number, lit: number, carU: number, brake: number, boost: number, drift: number) {
  const ink = N.c.magenta;
  const violet = N.c.violet;
  // Steer into the weave: the nose points where the car is heading.
  const vx = (heroX(t + 0.05) - heroX(t - 0.05)) / 0.1;
  // Steer into the snap; in a drift the tail swings out past it.
  const yaw = N.clamp(vx * 0.0009, -0.3, 0.3) * (1 + 0.9 * drift);
  const pose: Pose = { X: heroX(t), Z0: F / spread(carU), yaw, bob: 1.5 * Math.sin(t * 11), hy: HY, lz: LZ, hx: HX };
  const cam: W3 = { x: 0, y: CAM_Y, z: 0 };
  const centre = world(CENTRE, pose);
  const proj = (pts: V3[], mirror = false) => pts.map((v) => screen(world(v, pose), mirror));

  // Headlights: two pools of light on the road ahead of the nose, drawn
  // first because they lie beyond the car.
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const side of [-1, 1]) {
    const near = world([side * 110, 0, 770], pose);
    const far = world([side * 210, 0, 1900], pose);
    const nearW = world([side * 60, 0, 770], pose);
    const farW = world([side * 40, 0, 1900], pose);
    const a = screen(near), b = screen(far), c = screen(farW), d = screen(nearW);
    const g = ctx.createLinearGradient(0, a[1], 0, b[1]);
    g.addColorStop(0, N.rgba(N.c.white, 0.16));
    g.addColorStop(1, N.rgba(N.c.cyan, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    pathOf(ctx, [a, b, c, d]);
    ctx.fill();
  }
  ctx.restore();

  // The wet road mirrors the rear face and the lights, faintly.
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = N.rgba(violet, 0.07);
  ctx.beginPath();
  pathOf(ctx, proj(BODY_FACES[BODY_FACES.length - 1].pts, true));
  ctx.fill();
  ctx.fillStyle = N.rgba(N.c.orange, 0.12);
  ctx.beginPath();
  for (const l of LIGHTS) pathOf(ctx, proj(l, true));
  ctx.fill();
  ctx.restore();
  for (const side of [-1, 1]) {
    // Local units: world() applies the HX narrowing itself.
    const [gx, gy] = screen(world([side * 120, 0, 0], pose));
    N.glowDot(ctx, N.c.orange, gx, gy + 4, 20, 0.26 + 0.25 * brake);
  }

  // Tyres show under the body from behind.
  ctx.fillStyle = STAGE;
  ctx.beginPath();
  for (const tb of TYRE_BACKS) pathOf(ctx, proj(tb));
  ctx.fill();

  // Body faces, back-face culled, opaque then shaded by what light they face.
  const edges: [number, number][][] = [];
  const nearEdge = N.clamp((Math.abs(pose.X) + 180) / (ROAD + 60), 0, 1);
  for (const f of BODY_FACES) {
    const w = f.pts.map((v) => world(v, pose));
    let n = cross(sub(w[1], w[0]), sub(w[2], w[0]));
    const mid = { x: 0, y: 0, z: 0 };
    for (const q of w) { mid.x += q.x / w.length; mid.y += q.y / w.length; mid.z += q.z / w.length; }
    if (dot(n, sub(mid, centre)) < 0) n = { x: -n.x, y: -n.y, z: -n.z };
    if (dot(n, sub(cam, mid)) <= 0) continue;
    const sp = w.map((q) => screen(q));
    ctx.fillStyle = STAGE;
    ctx.beginPath();
    pathOf(ctx, sp);
    ctx.fill();
    let tint: string;
    if (f.kind === 'top') tint = N.rgba(N.mix(violet, ink, 0.5), 0.42 + 0.4 * lit);
    else if (f.kind === 'hood') tint = N.rgba(N.mix(violet, ink, 0.4), 0.3 + 0.3 * lit);
    else if (f.kind === 'rear') tint = N.rgba(violet, 0.3);
    else if (f.kind === 'glass') tint = N.rgba(violet, 0.08);
    else tint = N.rgba(violet, 0.2 + 0.12 * lit);
    ctx.fillStyle = tint;
    ctx.fill();
    // The flank toward the road edge catches the cyan edge line.
    if (f.kind === 'side' && Math.sign(mid.x - centre.x) === Math.sign(pose.X || 1)) {
      ctx.fillStyle = N.rgba(N.c.cyan, 0.1 * nearEdge);
      ctx.fill();
    }
    if (f.kind === 'glass') {
      // One slanted highlight on the back glass.
      const [a, b, c, d] = sp;
      ctx.strokeStyle = N.rgba(N.c.white, 0.15 + 0.2 * lit);
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(a[0] + (b[0] - a[0]) * 0.3, a[1] + (b[1] - a[1]) * 0.3);
      ctx.lineTo(d[0] + (c[0] - d[0]) * 0.15, d[1] + (c[1] - d[1]) * 0.15);
      ctx.stroke();
    }
    edges.push(sp);
  }
  N.glow(ctx, ink, 2.6, (c) => {
    for (const e of edges) pathOf(c, e);
  }, { intensity: 0.7 + 0.3 * lit, halo: 0.45 });
  N.glow(ctx, ink, 1.6, (c) => {
    for (const [a, b] of LOUVRES) {
      const pa = screen(world(a, pose));
      const pb = screen(world(b, pose));
      c.moveTo(pa[0], pa[1]);
      c.lineTo(pb[0], pb[1]);
    }
  }, { intensity: 0.35 + 0.3 * lit, halo: 0 });

  // Tail lights: orange slatted lenses, hot at the outer ends; a gate
  // passing overhead makes them flare.
  const lights = LIGHTS.map((l) => proj(l));
  ctx.fillStyle = N.rgba(N.c.orange, 0.92);
  ctx.beginPath();
  for (const l of lights) pathOf(ctx, l);
  ctx.fill();
  ctx.strokeStyle = STAGE;
  ctx.globalAlpha = 0.45;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  for (const l of lights) {
    for (let k = 1; k < 5; k++) {
      const f = k / 5;
      ctx.moveTo(l[0][0] + (l[3][0] - l[0][0]) * f, l[0][1] + (l[3][1] - l[0][1]) * f);
      ctx.lineTo(l[1][0] + (l[2][0] - l[1][0]) * f, l[1][1] + (l[2][1] - l[1][1]) * f);
    }
  }
  ctx.stroke();
  ctx.globalAlpha = 1;
  N.glow(ctx, N.c.orange, 4, (c) => {
    for (const l of lights) pathOf(c, l);
  }, { intensity: 0.85 + 0.1 * lit + 0.35 * brake, halo: 0.8 + 0.4 * brake });
  const hot = N.mix(N.c.orange, N.c.white, 0.55);
  for (const v of [onRear(-158, 58), onRear(158, 58)]) {
    const [hx, hy] = screen(world(v, pose));
    // Brake lights: the hot ends swell when the car slows.
    N.glowDot(ctx, hot, hx, hy, 7 + 6 * brake, 0.85 + 0.15 * lit);
  }

  // A blank plate, softly lit; two chrome exhaust tips.
  const plate = proj(PLATE);
  ctx.fillStyle = N.rgba(N.c.white, 0.18);
  ctx.beginPath();
  pathOf(ctx, plate);
  ctx.fill();
  for (const ex of [-60, 60]) {
    const q = world(onRear(ex, 30), pose);
    const [cx, cy] = screen(q);
    const r = 10 * (F / q.z);
    ctx.fillStyle = STAGE;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = N.rgba(N.c.white, 0.6);
    ctx.lineWidth = 2.5;
    ctx.stroke();
    // Accelerating: a flickering cyan-white flame out of the tip, toward you.
    if (boost > 0.05) {
      const flick = 0.6 + 0.4 * N.noise(t * 30 + ex);
      const len = r * (3 + 7 * boost * flick);
      N.glow(ctx, N.c.cyan, r * 0.9, (c) => {
        c.moveTo(cx, cy);
        c.lineTo(cx, cy + len);
      }, { intensity: boost * flick, halo: 0.6 });
      N.glowDot(ctx, N.mix(N.c.cyan, N.c.white, 0.6), cx, cy, r * 0.8, boost * flick);
    }
  }

  // The wing on its struts, nearest of all.
  const wing = proj(WING);
  ctx.fillStyle = STAGE;
  ctx.beginPath();
  pathOf(ctx, wing);
  ctx.fill();
  ctx.fillStyle = N.rgba(N.mix(violet, ink, 0.5), 0.35 + 0.4 * lit);
  ctx.fill();
  N.glow(ctx, ink, 3, (c) => {
    pathOf(c, wing);
    for (const [a, b] of STRUTS) {
      const pa = screen(world(a, pose));
      const pb = screen(world(b, pose));
      c.moveTo(pa[0], pa[1]);
      c.lineTo(pb[0], pb[1]);
    }
  }, { intensity: 0.85, halo: 0.5 });
}

// The traffic sedan: a boxy three-box saloon, upright rear, tall greenhouse.
const S0: V3 = [-165, 20, 0];
const S1: V3 = [-163, 80, 0];
const S2: V3 = [-163, 80, 640];
const S3: V3 = [-160, 72, 690];
const S4: V3 = [-160, 22, 700];
const K0: V3 = [-140, 80, 150];
const K1: V3 = [-125, 140, 230];
const K2: V3 = [-125, 140, 450];
const K3: V3 = [-140, 80, 540];
const SEDAN: Face[] = [
  { pts: [S0, S1, S2, S3, S4], kind: 'side' },
  { pts: [R(S0), R(S1), R(S2), R(S3), R(S4)], kind: 'side' },
  { pts: [S1, R(S1), R(S2), S2], kind: 'top' },
  { pts: [K0, K1, K2, K3], kind: 'side' },
  { pts: [R(K0), R(K1), R(K2), R(K3)], kind: 'side' },
  { pts: [K0, R(K0), R(K1), K1], kind: 'glass' },
  { pts: [K1, R(K1), R(K2), K2], kind: 'top' },
  { pts: [S0, R(S0), R(S1), S1], kind: 'rear' },
];
const SEDAN_LIGHTS: V3[][] = [
  [[-152, 48, 0], [-74, 48, 0], [-74, 68, 0], [-152, 68, 0]],
  [[74, 48, 0], [152, 48, 0], [152, 68, 0], [74, 68, 0]],
];
const SEDAN_CENTRE: V3 = [0, 60, 350];

/** A traffic sedan, Electro Ride style: dark body, crisp cyan rim, pink-red
 *  lights. near (0 to 1) flares it as the car slips past. */
function sedan(ctx: CanvasRenderingContext2D, N: NeonKit, r: Rival, near: number) {
  const sc0 = spread(r.u);
  const pose: Pose = { X: r.X, Z0: F / sc0, yaw: 0, bob: 0, hy: 1.3, lz: 0.85, hx: HX };
  const cam: W3 = { x: 0, y: CAM_Y, z: 0 };
  const centre = world(SEDAN_CENTRE, pose);
  const fade = Math.min(1, (r.u - 0.03) / 0.15);
  const edges: [number, number][][] = [];
  for (const f of SEDAN) {
    const w = f.pts.map((v) => world(v, pose));
    let n = cross(sub(w[1], w[0]), sub(w[2], w[0]));
    const mid = { x: 0, y: 0, z: 0 };
    for (const q of w) { mid.x += q.x / w.length; mid.y += q.y / w.length; mid.z += q.z / w.length; }
    if (dot(n, sub(mid, centre)) < 0) n = { x: -n.x, y: -n.y, z: -n.z };
    if (dot(n, sub(cam, mid)) <= 0) continue;
    const sp = w.map((q) => screen(q));
    ctx.fillStyle = STAGE;
    ctx.beginPath();
    pathOf(ctx, sp);
    ctx.fill();
    ctx.fillStyle = N.rgba(N.c.cyan, f.kind === 'top' ? 0.1 : f.kind === 'glass' ? 0.03 : 0.05);
    ctx.fill();
    edges.push(sp);
  }
  N.glow(ctx, N.c.cyan, 2.2, (c) => {
    for (const e of edges) pathOf(c, e);
  }, { intensity: (0.75 + 0.25 * near) * fade, halo: 0.4 });
  const lights = SEDAN_LIGHTS.map((l) => l.map((v) => screen(world(v, pose))));
  ctx.fillStyle = N.rgba(N.c.pink, 0.9 * fade);
  ctx.beginPath();
  for (const l of lights) pathOf(ctx, l);
  ctx.fill();
  N.glow(ctx, N.c.pink, 3, (c) => {
    for (const l of lights) pathOf(c, l);
  }, { intensity: 0.85 * fade, halo: 0.6 });
}

/** Tyre smoke and sparks off the rear wheels in a drift: puffs left behind
 *  roll toward you with the road, growing and fading. */
function smoke(ctx: CanvasRenderingContext2D, N: NeonKit, t: number, carU: number) {
  const dNow = travel(t);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 1; i <= 8; i++) {
    const age = i * 0.07;
    const d = driftOf(t - age);
    if (d <= 0) continue;
    const u = carU + (dNow - travel(t - age)) * ROLL;
    const sc = spread(u);
    for (const side of [-1, 1]) {
      const x = CX + (heroX(t - age) + side * 128) * sc;
      const y = floorY(u) - 20 * sc;
      const r = (14 + 60 * age) * sc * 1.5;
      ctx.fillStyle = N.rgba(N.c.white, 0.09 * d * (1 - i / 9));
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      ctx.fill();
      if (i <= 3) N.glowDot(ctx, N.c.orange, x + (h1(i * 7 + t * 31) - 0.5) * 30 * sc, y - h1(i * 3 + t * 17) * 20 * sc, 2.5, d);
    }
  }
  ctx.restore();
}

/** Speed streaks in the air beside the road when the car is flat out. */
function streaks(ctx: CanvasRenderingContext2D, N: NeonKit, t: number, k: number) {
  if (k <= 0) return;
  N.glow(ctx, N.c.white, 1.6, (c) => {
    for (let i = 0; i < 12; i++) {
      const side = i % 2 ? 1 : -1;
      const ang = (side < 0 ? Math.PI : 0) + side * (0.12 + 0.75 * h1(i * 5.1)) * (h1(i * 2.3) > 0.5 ? 1 : -1);
      const ph = (t * 1.6 + h1(i * 9.7)) % 1;
      const r0 = 140 + ph * 520;
      const len = 30 + 90 * ph;
      c.moveTo(CX + Math.cos(ang) * r0, HZ + Math.sin(ang) * r0 * 0.7);
      c.lineTo(CX + Math.cos(ang) * (r0 + len), HZ + Math.sin(ang) * (r0 + len) * 0.7);
    }
  }, { intensity: 0.45 * k, halo: 0.3 });
}

const face: NeonFace<State> = {
  id: 'neon-horizon',
  draw(ctx, T, N, state) {
    if (!state.stars || !state.city || !state.peaks) build(N, state);
    const stars = state.stars ?? [];
    const city = state.city ?? [];
    const peaks = state.peaks ?? [];
    const ink = N.c.magenta;
    const cyan = N.c.cyan;
    const violet = N.c.violet;
    // Drive time: the ambient clock shifted so whole beats land on the clock's
    // seconds, so the car snaps lanes on the ticks.
    const t = T.t + ((((T.sf - T.t) % 1) + 1) % 1);

    // Camera roll: the scene leans into each snap; the time stays level.
    const vxCam = (heroX(t + 0.05) - heroX(t - 0.05)) / 0.1;
    const roll = Math.max(-0.045, Math.min(0.045, -vxCam * 0.00005));
    ctx.save();
    ctx.translate(CX, 760);
    ctx.rotate(roll);
    ctx.translate(-CX, -760);

    // Sky: stars and the wide glow that sits on the horizon.
    N.layer(ctx, state, 'sky', 'static', (l) => {
      const buckets = [0.3, 0.5, 0.75];
      for (const b of buckets) {
        l.fillStyle = N.rgba(N.c.white, b);
        l.beginPath();
        for (const s of stars) if (Math.abs(s.a - b) < 0.13) l.rect(s.x, s.y, s.r, s.r);
        l.fill();
      }
      l.save();
      l.translate(CX, HZ);
      l.scale(1, 0.3);
      const g = l.createRadialGradient(0, 0, 0, 0, 0, 560);
      g.addColorStop(0, N.rgba(N.mix(ink, N.c.white, 0.4), 0.75));
      g.addColorStop(0.18, N.rgba(ink, 0.45));
      g.addColorStop(0.5, N.rgba(violet, 0.22));
      g.addColorStop(1, N.rgba(violet, 0));
      l.fillStyle = g;
      l.fillRect(-560, -560, 1120, 560);
      l.restore();
    });

    // A shooting star every 13 s, across the upper sky, for under a second.
    {
      const cycle = Math.floor(T.t / 13);
      const p = (T.t % 13) / 0.9;
      if (p < 1) {
        const sx = 260 + N.hash(cycle * 3.7) * 520;
        const sy = 70 + N.hash(cycle * 5.1) * 150;
        const dx = -260, dy = 120;
        const hx = sx + dx * p, hy = sy + dy * p;
        const tail = 0.28;
        N.glow(ctx, N.c.white, 2, (c) => {
          c.moveTo(hx - dx * tail, hy - dy * tail);
          c.lineTo(hx, hy);
        }, { intensity: Math.sin(Math.PI * p) * 0.8, halo: 0.5 });
      }
    }

    // Sun: noon highest, below the horizon at night with only its glow left.
    const elev = -Math.cos(T.dayFrac * TAU);
    const SR = 100;
    const sunY = HZ + 10 - 100 * elev; // noon: top at y 370, under the digits; midnight: fully set
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, 1000, HZ);
    ctx.clip();
    N.glowDot(ctx, ink, CX, sunY, 60, 0.45 + 0.25 * Math.max(0, elev));
    const g = ctx.createLinearGradient(0, sunY - SR, 0, sunY + SR);
    g.addColorStop(0, N.rgba(N.mix(ink, N.c.white, 0.55), 0.95));
    g.addColorStop(0.55, N.rgba(ink, 0.9));
    g.addColorStop(1, N.rgba(ink, 0.8));
    ctx.fillStyle = g;
    ctx.beginPath();
    const rows = 40;
    const rh = (2 * SR) / rows;
    const half = (y: number) => Math.sqrt(Math.max(0, SR * SR - (y - sunY) * (y - sunY)));
    for (let i = 0; i < rows; i++) {
      const f = i / rows;
      if (f > 0.3 && i % 5 < 1 + Math.floor(((f - 0.3) / 0.7) * 3)) continue;
      const ya = sunY - SR + i * rh;
      const yb = ya + rh + 0.4;
      const ha = half(ya + 0.01);
      const hb = half(yb - 0.01);
      ctx.moveTo(CX - ha, ya);
      ctx.lineTo(CX + ha, ya);
      ctx.lineTo(CX + hb, yb);
      ctx.lineTo(CX - hb, yb);
      ctx.closePath();
    }
    ctx.fill();
    ctx.restore();

    // The city and the two ranges: dark shapes in front of the sun, faintly violet.
    ctx.beginPath();
    for (const b of city) ctx.rect(b.x, HZ - b.h, b.w, b.h);
    for (const r of peaks) {
      ctx.moveTo(r[0][0], r[0][1]);
      for (let i = 1; i < r.length; i++) ctx.lineTo(r[i][0], r[i][1]);
      ctx.closePath();
    }
    ctx.fillStyle = STAGE;
    ctx.fill();
    ctx.fillStyle = N.rgba(violet, 0.1);
    ctx.fill();

    // The floor: violet rungs rolling toward you, one spacing a second.
    // The drive: distance, speed, the car's depth, braking and boosting.
    const dist = travel(t);
    const carU = carDepth(t);
    const a = accel(t);
    const brake = N.clamp(-a / 0.55, 0, 1);
    const boost = N.clamp(a / 0.45, 0, 1);
    const fr = ((dist % 1) + 1) % 1;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, HZ, 1000, 500);
    ctx.clip();
    for (let j = 0; j < 9; j++) {
      const u = (j + fr) / 9;
      const y = floorY(u);
      N.glow(ctx, violet, 2.5 + 2 * u, (c) => {
        c.moveTo(0, y);
        c.lineTo(1000, y);
      }, { intensity: (0.15 + 0.45 * u) * (u < 0.06 ? u / 0.06 : 1), halo: 0.4 });
    }
    ctx.restore();

    // The road: dark tarmac between the edge lines.
    const far = spread(1.12);
    ctx.fillStyle = STAGE;
    ctx.beginPath();
    ctx.moveTo(CX - 2, HZ);
    ctx.lineTo(CX + 2, HZ);
    ctx.lineTo(CX + ROAD * far, floorY(1.12));
    ctx.lineTo(CX - ROAD * far, floorY(1.12));
    ctx.closePath();
    ctx.fill();

    // Everything still: city windows and roofs, the horizon line, the floor's
    // long lines, the cyan road edges, and the time.
    N.layer(ctx, state, 'fixed', T.hh + T.mm, (l) => {
      const tints = [N.c.white, cyan, N.c.pink];
      for (let ti = 0; ti < tints.length; ti++) {
        l.fillStyle = N.rgba(tints[ti], ti === 0 ? 0.42 : 0.55);
        l.beginPath();
        city.forEach((b, bi) => {
          for (let wy = HZ - b.h + 8; wy < HZ - 8; wy += 9) {
            for (let wx = b.x + 4; wx < b.x + b.w - 6; wx += 8) {
              const r = N.hash(bi * 131 + wy * 7 + wx);
              if (r < 0.6) continue;
              const tint = r < 0.84 ? 0 : r < 0.94 ? 1 : 2;
              if (tint === ti) l.rect(wx, wy, 4, 3);
            }
          }
        });
        l.fill();
      }
      N.glow(l, violet, 2, (c) => {
        for (const b of city) {
          c.moveTo(b.x, HZ - b.h);
          c.lineTo(b.x + b.w, HZ - b.h);
        }
      }, { intensity: 0.35, halo: 0.3 });
      for (const b of city) {
        if (!b.antenna) continue;
        l.strokeStyle = N.rgba(violet, 0.5);
        l.lineWidth = 1.5;
        l.beginPath();
        l.moveTo(b.x + b.w / 2, HZ - b.h);
        l.lineTo(b.x + b.w / 2, HZ - b.h - 26);
        l.stroke();
      }

      // The ranges as low-poly wireframe: the ridge, and from every peak a
      // facet edge down to the base, zig-zagging like a polygon mesh.
      N.glow(l, cyan, 2, (c) => {
        for (const r of peaks) {
          c.moveTo(r[0][0], r[0][1]);
          for (let i = 1; i < r.length; i++) c.lineTo(r[i][0], r[i][1]);
          // Facets: from every peak a diagonal down each side, meeting the
          // base halfway to its neighbours.
          for (let i = 1; i < r.length - 1; i++) {
            const [px, py] = r[i];
            const left = (px + r[i - 1][0]) / 2;
            const right = (px + r[i + 1][0]) / 2;
            c.moveTo(left, HZ);
            c.lineTo(px, py);
            c.lineTo(right, HZ);
          }
        }
      }, { intensity: 0.5, halo: 0.4 });

      l.save();
      l.beginPath();
      l.rect(0, HZ, 1000, 500);
      l.clip();
      N.glow(l, violet, 2.5, (c) => {
        for (const X of [560, 780, 1080, 1500, 2300]) {
          for (const side of [-1, 1]) {
            c.moveTo(CX, HZ);
            c.lineTo(CX + side * X * far, floorY(1.12));
          }
        }
      }, { intensity: 0.3, halo: 0.4 });
      N.glow(l, cyan, 4.5, (c) => {
        for (const side of [-1, 1]) {
          c.moveTo(CX, HZ);
          c.lineTo(CX + side * ROAD * far, floorY(1.12));
        }
      }, { intensity: 0.9, halo: 0.7 });
      l.restore();

      N.glow(l, ink, 4.5, (c) => {
        c.moveTo(30, HZ);
        c.lineTo(970, HZ);
      }, { intensity: 0.9 });

    });

    // Antenna tips blink slowly, each on its own beat.
    city.forEach((b, bi) => {
      if (!b.antenna) return;
      const on = 0.5 + 0.5 * Math.sin(T.t * 1.6 + bi * 1.9);
      N.glowDot(ctx, N.c.pink, b.x + b.w / 2, HZ - b.h - 27, 3.5, 0.35 + 0.5 * on);
    });

    // Lane dashes: cyan, rolling with the floor, wider as they come closer.
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, HZ, 1000, 500);
    ctx.clip();
    for (const [lo, hi, w, k] of [[0, 4, 2.5, 0.55], [4, 10, 5, 0.9]] as const) {
      N.glow(ctx, cyan, w, (c) => {
        for (let j = lo; j < hi; j++) {
          const u0 = (j + fr) / 9;
          const u1 = (j + fr + 0.42) / 9;
          for (const side of [-1, 1]) {
            c.moveTo(CX + side * LANE * spread(u0), floorY(u0));
            c.lineTo(CX + side * LANE * spread(u1), floorY(u1));
          }
        }
      }, { intensity: k, halo: 0.5, cap: 'butt' });
    }
    ctx.restore();

    // Gates behind the car, then the trails and the car, then gates nearer
    // than the car, which pass over it.
    const depths = gateDepths(dist);
    const trees = palmSlots(dist);
    const rivals = trafficNow(t, carU);
    const nearness = (r: Rival) => Math.exp(-(((r.u - carU) / 0.08) ** 2));
    gates(ctx, N, depths.filter((u) => u <= carU));
    palms(ctx, N, trees.filter((p) => p.u <= carU));
    for (const r of rivals.filter((q) => q.u <= carU).sort((p1, p2) => p1.u - p2.u)) sedan(ctx, N, r, nearness(r));
    smoke(ctx, N, t, carU);
    trails(ctx, N, t, carU);
    car(ctx, N, t, gateLight(depths, carU), carU, brake, boost, driftOf(t));
    for (const r of rivals.filter((q) => q.u > carU).sort((p1, p2) => p1.u - p2.u)) sedan(ctx, N, r, nearness(r));
    gates(ctx, N, depths.filter((u) => u > carU));
    palms(ctx, N, trees.filter((p) => p.u > carU));
    streaks(ctx, N, t, N.clamp((speed(t) / SPEED_BASE - 1.15) / 0.35, 0, 1));
    ctx.restore(); // end of the rolled scene

    // The time, level and on top of everything.
    N.layer(ctx, state, 'time', T.hh + T.mm, (l) => {
      // The time: cyan seven-segment tubes, the one thing at full intensity.
      const DW = 84, DH = 172, GAP = 26, COLON = 62;
      const pair = DW * 2 + GAP;
      const x0 = CX - (pair * 2 + COLON) / 2;
      const y0 = 138;
      const digits = [T.hh[0], T.hh[1], T.mm[0], T.mm[1]];
      const px = [x0, x0 + DW + GAP, x0 + pair + COLON, x0 + pair + COLON + DW + GAP];
      N.glow(l, cyan, 3, (c) => {
        for (let i = 0; i < 4; i++) N.seg7(c, digits[i], px[i], y0, DW, DH, { off: true, gap: 9 });
      }, { intensity: 0.1, halo: 0 });
      N.glow(l, cyan, 14, (c) => {
        for (let i = 0; i < 4; i++) N.seg7(c, digits[i], px[i], y0, DW, DH, { gap: 9 });
      }, { intensity: 1 });
    });

    // The colon: two cyan dots that breathe once a second.
    const DH = 172, y0 = 138, DW = 84, GAP = 26, COLON = 62;
    const colonX = CX - (DW * 4 + GAP * 2 + COLON) / 2 + (DW * 2 + GAP) + COLON / 2;
    const on = 0.55 + 0.45 * (0.5 + 0.5 * Math.cos(TAU * (T.sf % 1)));
    N.glowDot(ctx, cyan, colonX, y0 + DH * 0.3, 8, on);
    N.glowDot(ctx, cyan, colonX, y0 + DH * 0.7, 8, on);
  },
};

export default face;
