import { describe, it, expect } from 'vitest';
import { createAlertStore, type RingingAlert } from '../../core/alerts/alert-store';
import { createAlarmStore } from './alarm-store';
import { alarmAppSchema } from '../../shared/schemas/app.alarm';
import {
  ALARM_RING_MS, alarmAlertId, alarmSettings, cancelSnooze, nextScheduledAlarm, snoozeAlarm, snoozeAlertId,
  startAlarmSync, syncAlarmAlerts,
} from './alarm-sync';
import type { DeviceConfig } from '../../shared/types';

const defaults = alarmAppSchema.parse({});
const fri = new Date(2026, 9, 2, 22, 38);
const sat0710 = new Date(2026, 9, 3, 7, 10).getTime();

function setup() {
  const alerts = createAlertStore(null);
  let n = 0;
  const alarms = createAlarmStore(null, () => `a${(n += 1)}`);
  return { alerts, alarms };
}

describe('syncAlarmAlerts', () => {
  it('schedules each enabled alarm with its ring length, brightness and lead', () => {
    const { alerts, alarms } = setup();
    alarms.getState().add('07:10', []);
    syncAlarmAlerts(alarms.getState().alarms, alerts, defaults, fri);
    expect(alerts.getState().scheduled).toEqual([
      {
        id: 'alarm:a1', appId: 'alarm', firesAt: sat0710, sound: true, bright: true, ringMs: ALARM_RING_MS,
        leadMs: 10 * 60_000, payload: { alarmId: 'a1', time: '07:10' },
      },
    ]);
  });

  it('omits the lead when gentle wake is 0 and passes sound through', () => {
    const { alerts, alarms } = setup();
    alarms.getState().add('07:10', []);
    syncAlarmAlerts(alarms.getState().alarms, alerts, { ...defaults, gentleWakeMinutes: 0, sound: false }, fri);
    expect(alerts.getState().scheduled[0].leadMs).toBeUndefined();
    expect(alerts.getState().scheduled[0].sound).toBe(false);
  });

  it('cancels a disabled alarm; a deleted alarm loses its alert and snooze', () => {
    const { alerts, alarms } = setup();
    const id = alarms.getState().add('07:10', []);
    syncAlarmAlerts(alarms.getState().alarms, alerts, defaults, fri);
    alarms.getState().toggle(id);
    syncAlarmAlerts(alarms.getState().alarms, alerts, defaults, fri);
    expect(alerts.getState().scheduled).toEqual([]);
    alarms.getState().toggle(id);
    syncAlarmAlerts(alarms.getState().alarms, alerts, defaults, fri);
    alerts.getState().schedule({ id: snoozeAlertId(id), appId: 'alarm', firesAt: 1, sound: true, payload: { alarmId: id } });
    alarms.getState().remove(id);
    syncAlarmAlerts(alarms.getState().alarms, alerts, defaults, fri);
    expect(alerts.getState().scheduled).toEqual([]);
  });

  it('leaves an overdue alert for the scheduler, so a clock that was off still shows Missed', () => {
    const { alerts, alarms } = setup();
    alarms.getState().add('07:10', [0, 1, 2, 3, 4, 5, 6]);
    syncAlarmAlerts(alarms.getState().alarms, alerts, defaults, fri);
    const sat0900 = new Date(2026, 9, 3, 9, 0);
    syncAlarmAlerts(alarms.getState().alarms, alerts, defaults, sat0900);
    expect(alerts.getState().scheduled[0].firesAt).toBe(sat0710);
  });

  it('is idempotent: a second run writes nothing', () => {
    const { alerts, alarms } = setup();
    alarms.getState().add('07:10', [1, 2, 3, 4, 5]);
    syncAlarmAlerts(alarms.getState().alarms, alerts, defaults, fri);
    let writes = 0;
    alerts.subscribe(() => (writes += 1));
    syncAlarmAlerts(alarms.getState().alarms, alerts, defaults, fri);
    expect(writes).toBe(0);
  });
});

describe('startAlarmSync', () => {
  function start() {
    const { alerts, alarms } = setup();
    let clock = fri;
    const stop = startAlarmSync({
      alarms, alerts, loadConfig: () => null, subscribeConfig: () => () => {}, now: () => clock,
    });
    return { alerts, alarms, stop, setClock: (d: Date) => (clock = d) };
  }

  it('schedules on start and on every alarm change', () => {
    const { alerts, alarms } = start();
    alarms.getState().add('07:10', []);
    expect(alerts.getState().scheduled.map((a) => a.id)).toEqual(['alarm:a1']);
  });

  it('schedules the next occurrence the moment a repeating alarm fires', () => {
    const { alerts, alarms, setClock } = start();
    alarms.getState().add('07:10', [0, 1, 2, 3, 4, 5, 6]);
    setClock(new Date(2026, 9, 3, 7, 10, 1));
    alerts.getState().fire(alarmAlertId('a1'), sat0710);
    expect(alerts.getState().ringing?.id).toBe('alarm:a1');
    expect(alerts.getState().scheduled[0]).toMatchObject({ id: 'alarm:a1', firesAt: new Date(2026, 9, 4, 7, 10).getTime() });
  });

  it('turns a once-alarm off when it fires', () => {
    const { alerts, alarms, setClock } = start();
    alarms.getState().add('07:10', []);
    setClock(new Date(2026, 9, 3, 7, 10, 1));
    alerts.getState().fire(alarmAlertId('a1'), sat0710);
    expect(alarms.getState().alarms[0].enabled).toBe(false);
    expect(alerts.getState().scheduled).toEqual([]);
  });

  it('leaves the alarms alone when a snooze fires', () => {
    const { alerts, alarms } = start();
    alarms.getState().add('07:10', []);
    alerts.getState().schedule({ id: snoozeAlertId('a1'), appId: 'alarm', firesAt: 0, sound: true, payload: { alarmId: 'a1' } });
    alerts.getState().fire(snoozeAlertId('a1'), 0);
    expect(alarms.getState().alarms[0].enabled).toBe(true);
  });
});

describe('snooze and helpers', () => {
  const ringing: RingingAlert = {
    id: 'alarm:a1', appId: 'alarm', firesAt: 0, firedAt: 0, sound: true, settled: false, bright: true,
    ringMs: ALARM_RING_MS, payload: { alarmId: 'a1', time: '07:10' },
  };

  it('snooze dismisses and schedules the snooze alert', () => {
    const alerts = createAlertStore(null);
    alerts.setState({ ringing });
    snoozeAlarm(ringing, 9, 1000, alerts);
    expect(alerts.getState().ringing).toBeNull();
    expect(alerts.getState().scheduled[0]).toMatchObject({
      id: 'alarm:a1:snooze', firesAt: 1000 + 9 * 60_000, bright: true, ringMs: ALARM_RING_MS, payload: { alarmId: 'a1', time: '07:10' },
    });
    cancelSnooze('a1', alerts);
    expect(alerts.getState().scheduled).toEqual([]);
  });

  it('finds the next real alarm, ignoring snoozes and other apps', () => {
    expect(
      nextScheduledAlarm([
        { id: 'alarm:a1:snooze', appId: 'alarm', firesAt: 5, sound: true, payload: {} },
        { id: 'timer', appId: 'timer', firesAt: 6, sound: true, payload: {} },
        { id: 'alarm:a2', appId: 'alarm', firesAt: 9, sound: true, payload: {} },
      ]),
    ).toBe(9);
    expect(nextScheduledAlarm([])).toBeNull();
  });

  it('reads settings from the first alarm screen, else defaults', () => {
    const config = {
      instances: [
        { id: 'x', appId: 'clock', config: {} },
        { id: 'y', appId: 'alarm', config: { snoozeMinutes: 5, gentleWakeMinutes: 0 } },
      ],
    } as unknown as DeviceConfig;
    expect(alarmSettings(config)).toEqual({ snoozeMinutes: 5, sound: true, gentleWakeMinutes: 0 });
    expect(alarmSettings(null)).toEqual(defaults);
    const bad = { instances: [{ id: 'y', appId: 'alarm', config: { snoozeMinutes: 99 } }] } as unknown as DeviceConfig;
    expect(alarmSettings(bad)).toEqual(defaults);
  });

  it('falls back to defaults for a cached config with no instances', () => {
    expect(alarmSettings({} as unknown as DeviceConfig)).toEqual(defaults);
  });
});
