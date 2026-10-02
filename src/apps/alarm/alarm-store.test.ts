import { describe, it, expect } from 'vitest';
import { ALARM_STORAGE_KEY, createAlarmStore } from './alarm-store';

function memory() {
  const data = new Map<string, string>();
  return { data, getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) };
}
const ids = () => {
  let n = 0;
  return () => `id${(n += 1)}`;
};

describe('alarm store', () => {
  it('adds enabled alarms with normalised days, updates, toggles and removes', () => {
    const s = createAlarmStore(null, ids());
    const id = s.getState().add('07:10', [5, 1, 3, 1]);
    expect(s.getState().alarms).toEqual([{ id: 'id1', time: '07:10', days: [1, 3, 5], enabled: true }]);
    s.getState().update(id, { time: '06:45', days: [0, 6] });
    expect(s.getState().alarms[0]).toMatchObject({ time: '06:45', days: [0, 6] });
    s.getState().toggle(id);
    expect(s.getState().alarms[0].enabled).toBe(false);
    s.getState().remove(id);
    expect(s.getState().alarms).toEqual([]);
  });

  it('round-trips through storage and loads none from corrupt data', () => {
    const mem = memory();
    createAlarmStore(mem, ids()).getState().add('07:10', []);
    expect(createAlarmStore(mem).getState().alarms).toHaveLength(1);
    mem.data.set(ALARM_STORAGE_KEY, JSON.stringify([{ id: 'x', time: '25:00', days: [], enabled: true }]));
    expect(createAlarmStore(mem).getState().alarms).toEqual([]);
  });
});
