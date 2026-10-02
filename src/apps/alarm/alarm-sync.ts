// Keeps one core alert per enabled alarm, at its next occurrence. Started once
// at boot from index.ts. Subscriptions only, no timers: the core scheduler owns
// every boundary.
import {
  createAlertStore, useAlerts, type AlertState, type RingingAlert, type ScheduledAlert,
} from '../../core/alerts/alert-store';
import { loadLocalConfig, subscribeToConfig } from '../../shared/local-config';
import type { DeviceConfig } from '../../shared/types';
import { alarmAppSchema, type AlarmAppConfig } from '../../shared/schemas/app.alarm';
import { createAlarmStore, useAlarms, type Alarm } from './alarm-store';
import { nextOccurrence } from './alarm-schedule';

export const ALARM_RING_MS = 15 * 60_000;
export const alarmAlertId = (id: string) => `alarm:${id}`;
export const snoozeAlertId = (id: string) => `alarm:${id}:snooze`;

type AlertsApi = { getState(): AlertState };
type Unsub = () => void;

/** Alarm settings are device-wide: the first Alarm screen's config, else defaults. */
export function alarmSettings(config: DeviceConfig | null | undefined): AlarmAppConfig {
  const instance = config?.instances.find((i) => i.appId === 'alarm');
  const parsed = alarmAppSchema.safeParse(instance?.config ?? {});
  return parsed.success ? parsed.data : alarmAppSchema.parse({});
}

function alertFor(alarm: Alarm, firesAt: number, settings: AlarmAppConfig): ScheduledAlert {
  return {
    id: alarmAlertId(alarm.id),
    appId: 'alarm',
    firesAt,
    sound: settings.sound,
    bright: true,
    ringMs: ALARM_RING_MS,
    payload: { alarmId: alarm.id, time: alarm.time },
    ...(settings.gentleWakeMinutes > 0 ? { leadMs: settings.gentleWakeMinutes * 60_000 } : {}),
  };
}

function sameAlert(a: ScheduledAlert, b: ScheduledAlert): boolean {
  return (
    a.firesAt === b.firesAt &&
    a.sound === b.sound &&
    a.bright === b.bright &&
    a.ringMs === b.ringMs &&
    a.leadMs === b.leadMs &&
    a.payload.time === b.payload.time
  );
}

export function syncAlarmAlerts(alarms: Alarm[], alerts: AlertsApi, settings: AlarmAppConfig, now: Date): void {
  for (const alarm of alarms) {
    const at = nextOccurrence(alarm, now);
    if (at === null) {
      alerts.getState().cancel(alarmAlertId(alarm.id));
      continue;
    }
    const want = alertFor(alarm, at, settings);
    const have = alerts.getState().scheduled.find((a) => a.id === want.id);
    // An overdue alert (the clock was off or restarting at alarm time) is the
    // scheduler's to fire, so it rings or shows Missed; the ring then
    // schedules the next occurrence.
    if (have && have.firesAt <= now.getTime()) continue;
    if (!have || !sameAlert(have, want)) alerts.getState().schedule(want);
  }
  // A deleted alarm loses its alert and any pending snooze.
  const ids = new Set(alarms.map((a) => a.id));
  for (const a of alerts.getState().scheduled) {
    if (a.appId === 'alarm' && !ids.has(String(a.payload.alarmId))) alerts.getState().cancel(a.id);
  }
}

interface SyncDeps {
  alarms: ReturnType<typeof createAlarmStore>;
  alerts: ReturnType<typeof createAlertStore>;
  loadConfig: () => DeviceConfig | null;
  subscribeConfig: (listener: () => void) => Unsub;
  now: () => Date;
}

const defaultDeps: SyncDeps = {
  alarms: useAlarms,
  alerts: useAlerts,
  loadConfig: loadLocalConfig,
  subscribeConfig: subscribeToConfig,
  now: () => new Date(),
};

export function startAlarmSync(deps: SyncDeps = defaultDeps): Unsub {
  const run = () =>
    syncAlarmAlerts(deps.alarms.getState().alarms, deps.alerts, alarmSettings(deps.loadConfig()), deps.now());
  run();
  const offAlarms = deps.alarms.subscribe(run);
  const offConfig = deps.subscribeConfig(run);
  const offAlerts = deps.alerts.subscribe((s, prev) => {
    const r = s.ringing;
    if (!r || r.id === prev.ringing?.id || r.appId !== 'alarm' || r.id.endsWith(':snooze')) return;
    const alarmId = String(r.payload.alarmId);
    const alarm = deps.alarms.getState().alarms.find((a) => a.id === alarmId);
    // A once-alarm turns itself off (that re-syncs through the alarm store);
    // a repeating one gets its next occurrence now.
    if (alarm && alarm.enabled && alarm.days.length === 0) deps.alarms.getState().update(alarmId, { enabled: false });
    else run();
  });
  return () => {
    offAlarms();
    offConfig();
    offAlerts();
  };
}

export function snoozeAlarm(alert: RingingAlert, minutes: number, now: number, alerts: AlertsApi = useAlerts): void {
  const alarmId = String(alert.payload.alarmId);
  alerts.getState().dismiss();
  alerts.getState().schedule({
    id: snoozeAlertId(alarmId),
    appId: 'alarm',
    firesAt: now + minutes * 60_000,
    sound: alert.sound,
    bright: true,
    ringMs: ALARM_RING_MS,
    payload: { alarmId, time: alert.payload.time },
  });
}

/** Turning an alarm off or deleting it from the screen also drops its snooze. */
export function cancelSnooze(alarmId: string, alerts: AlertsApi = useAlerts): void {
  alerts.getState().cancel(snoozeAlertId(alarmId));
}

export function nextScheduledAlarm(scheduled: ScheduledAlert[]): number | null {
  let best: number | null = null;
  for (const a of scheduled) {
    if (a.appId === 'alarm' && !a.id.endsWith(':snooze') && (best === null || a.firesAt < best)) best = a.firesAt;
  }
  return best;
}
