import { describe, expect, it } from 'vitest';
import { FOOTPRINT, carDepth, heroX, trafficNow } from './faces/horizon';

// Horizon's dodge game is a pure function of time: the car's lane schedule
// and the traffic placed from it. Nothing on screen checks that a sedan and
// the car never drive through each other, and every tuning of the snap,
// the block or the traffic timing can break it, so this drives fifteen
// minutes at 50 samples a second and checks every pair.
const { F, spread, heroHalfW, heroLen, sedanHalfW, sedanLen } = FOOTPRINT;

describe('horizon dodge schedule', () => {
  it('never overlaps the car with a traffic sedan over fifteen minutes', () => {
    const hits: string[] = [];
    let seen = 0;
    for (let t = 0; t < 900; t += 0.02) {
      const carU = carDepth(t);
      const zCar = F / spread(carU);
      const xCar = heroX(t);
      for (const r of trafficNow(t, carU)) {
        seen++;
        const zSedan = F / spread(r.u);
        const alongside = zSedan < zCar + heroLen && zCar < zSedan + sedanLen;
        const sideBySide = Math.abs(xCar - r.X) < heroHalfW + sedanHalfW;
        if (alongside && sideBySide) hits.push(`t=${t.toFixed(2)} sedan ${r.id} gap ${(Math.abs(xCar - r.X) - heroHalfW - sedanHalfW).toFixed(0)}`);
      }
    }
    expect(seen, 'the schedule produced no traffic at all, so the check proved nothing').toBeGreaterThan(1000);
    expect(hits.slice(0, 5), `${hits.length} overlapping samples`).toEqual([]);
  });
});
