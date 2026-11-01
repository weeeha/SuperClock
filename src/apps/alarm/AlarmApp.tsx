import { useEffect, useMemo, useRef, useState } from 'react';
import { useHomeHold } from '../../core/hooks/useHomeHold';
import { AlarmClock } from 'lucide-react';
import type { AppProps } from '../../core/types';
import { useNavigation } from '../../core/navigation';
import RoundList from '../../core/widgets/RoundList';
import { alarmAppSchema } from '../../shared/schemas/app.alarm';
import { useAlarms, type Alarm } from './alarm-store';
import { DAY_LETTERS, DAY_NAMES, daysLabel, nextAlarm, parseTime, stepTime, untilLabel } from './alarm-schedule';
import { cancelSnooze } from './alarm-sync';
import AlarmDial from './AlarmDial';

const NEW_ALARM_TIME = '07:00';
const R = 380; // the visible ring sits inside the dial band (300 to 435 units)
const ADD = 'add' as const;

type Edit = { id: string | null; time: string; days: number[]; mode: 'minutes' | 'hours' };
type View = { kind: 'resting' } | { kind: 'list' } | ({ kind: 'edit' } & Edit);

function persistEdit(e: Edit): void {
  const store = useAlarms.getState();
  if (e.id) store.update(e.id, { time: e.time, days: e.days, enabled: true });
  else store.add(e.time, e.days);
}

function toggleAlarm(alarm: Alarm): void {
  if (alarm.enabled) cancelSnooze(alarm.id);
  useAlarms.getState().toggle(alarm.id);
}

/** Display-only day pills (board frames 1 and 2); "Once" when there are none. */
function Pills({ days, className = '' }: { days: number[]; className?: string }) {
  if (days.length === 0) return <p className={`theme-fade text-[2.2vmin] text-(--face-ink-muted) ${className}`}>Once</p>;
  return (
    <div role="img" aria-label={daysLabel(days)} className={`flex gap-[0.8vmin] ${className}`}>
      {DAY_LETTERS.map((letter, d) => (
        <span
          key={d}
          aria-hidden="true"
          className={`theme-fade flex h-[3.4vmin] w-[3.4vmin] items-center justify-center rounded-full text-[2.2vmin] ${
            days.includes(d) ? 'bg-(--face-ink) text-(--face-bg)' : 'bg-(--face-ghost) text-(--face-ink-muted)'
          }`}
        >
          {letter}
        </span>
      ))}
    </div>
  );
}

/** The quick-settings toggle's shape, recoloured for the face palette. */
function ArmedSwitch({ on, label, onToggle }: { on: boolean; label: string; onToggle: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation(); // a row switch must not open the editor
        onToggle();
      }}
      className={`h-11 w-20 shrink-0 rounded-full transition-colors ${on ? 'bg-(--color-accent)' : 'bg-(--face-ghost)'}`}
    >
      <span
        className={`block h-9 w-9 rounded-full bg-(--face-bg) transition-transform ${on ? 'translate-x-10' : 'translate-x-1'}`}
      />
    </button>
  );
}

/** Alarm: resting ⇅ list, tap a row to set it, the core alert layer rings it. */
export default function AlarmApp({ isActive, config }: AppProps) {
  const cfg = useMemo(() => {
    const parsed = alarmAppSchema.safeParse(config ?? {});
    return parsed.success ? parsed.data : alarmAppSchema.parse({});
  }, [config]);
  const alarms = useAlarms((s) => s.alarms);
  const setVerticalSwipeCallback = useNavigation((s) => s.setVerticalSwipeCallback);
  const setBackCallback = useNavigation((s) => s.setBackCallback);
  const showGrid = useNavigation((s) => s.showGrid);
  const [view, setView] = useState<View>({ kind: 'resting' });
  useHomeHold('alarm', isActive && view.kind === 'edit');

  const [now, setNow] = useState(() => Date.now());
  // The "in 8h 32m" line: once a minute, only while active (KIO-1). Becoming
  // active also catches up at once, after being swiped away; that read sits in
  // a callback because the purity rule forbids Date.now() during render.
  useEffect(() => {
    if (!isActive) return;
    const catchUp = setTimeout(() => setNow(Date.now()), 0);
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => {
      clearTimeout(catchUp);
      clearInterval(id);
    };
  }, [isActive]);

  // Resting ⇅ list through the shell's slot, HabitsApp's guarded shape.
  useEffect(() => {
    if (!isActive) {
      setVerticalSwipeCallback(null);
      return;
    }
    if (view.kind === 'edit') return;
    const cb = (dir: 'up' | 'down') => {
      if (dir === 'up' && view.kind === 'resting') setView({ kind: 'list' });
      else if (dir === 'down' && view.kind === 'list') setView({ kind: 'resting' });
      else if (dir === 'down') showGrid(); // swipe down at resting = the shell's default
    };
    setVerticalSwipeCallback(cb);
    return () => {
      // popLayout keeps the exiting app mounted after the next app registers;
      // only clear the slot if it is still ours.
      if (useNavigation.getState().verticalSwipeCallback === cb) setVerticalSwipeCallback(null);
    };
  }, [isActive, view.kind, setVerticalSwipeCallback, showGrid]);

  // The back gesture saves the alarm being edited, CalendarApp's guarded shape.
  useEffect(() => {
    if (!isActive || view.kind !== 'edit') return;
    const cb = () => {
      persistEdit(view);
      setView({ kind: 'list' });
    };
    setBackCallback(cb);
    return () => {
      if (useNavigation.getState().backCallback === cb) setBackCallback(null);
    };
  }, [isActive, view, setBackCallback]);

  const remainder = useRef(0);
  const startEdit = (alarm: Alarm | null) => {
    remainder.current = 0;
    setView({
      kind: 'edit',
      id: alarm ? alarm.id : null,
      time: alarm ? alarm.time : NEW_ALARM_TIME,
      days: alarm ? alarm.days : [],
      mode: 'minutes',
    });
  };

  if (view.kind === 'edit') {
    const rotate = (deltaDeg: number) => {
      const stepDeg = view.mode === 'minutes' ? 30 : 15; // 60 minutes or 24 hours a turn
      remainder.current += deltaDeg;
      const steps = Math.trunc(remainder.current / stepDeg);
      if (steps === 0) return;
      remainder.current -= steps * stepDeg;
      setView({ ...view, time: stepTime(view.time, view.mode, steps) });
    };
    const { h, m } = parseTime(view.time);
    const knob = ((view.mode === 'minutes' ? m * 6 : h * 15) * Math.PI) / 180;
    return (
      <div className="theme-fade relative flex h-full w-full items-center justify-center bg-(--face-bg)">
        <svg viewBox="0 0 1000 1000" className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
          <circle cx="500" cy="500" r={R} strokeWidth="26" className="fill-none stroke-(--face-ghost)" />
          {Array.from({ length: 12 }, (_, i) => {
            const a = (i * 30 * Math.PI) / 180;
            return <circle key={i} cx={500 + 420 * Math.sin(a)} cy={500 - 420 * Math.cos(a)} r="5" className="fill-(--face-ink-muted)" />;
          })}
          <circle cx={500 + R * Math.sin(knob)} cy={500 - R * Math.cos(knob)} r="26" className="fill-(--color-accent)" />
        </svg>
        <AlarmDial onRotate={rotate} />
        <div className="relative flex flex-col items-center text-center">
          <button
            type="button"
            aria-label={view.mode === 'minutes' ? 'Switch the dial to hours' : 'Switch the dial to minutes'}
            onClick={() => {
              remainder.current = 0;
              setView({ ...view, mode: view.mode === 'minutes' ? 'hours' : 'minutes' });
            }}
            className="theme-fade text-[17vmin] leading-none tabular-nums text-(--face-ink)"
          >
            {view.time}
          </button>
          <p className="theme-fade mt-[1.5vmin] text-[2.2vmin] text-(--face-ink-muted)">
            {view.mode === 'minutes' ? 'Dial sets minutes · tap the time for hours' : 'Dial sets hours · tap the time for minutes'}
          </p>
          <div className="mt-[3vmin] flex gap-[1vmin]">
            {DAY_LETTERS.map((letter, d) => {
              const on = view.days.includes(d);
              return (
                <button
                  key={d}
                  type="button"
                  aria-pressed={on}
                  aria-label={DAY_NAMES[d]}
                  onClick={() => setView({ ...view, days: on ? view.days.filter((x) => x !== d) : [...view.days, d] })}
                  className={`theme-fade h-[5.6vmin] w-[5.6vmin] rounded-full text-[2.2vmin] ${
                    on ? 'bg-(--face-ink) text-(--face-bg)' : 'bg-(--face-ghost) text-(--face-ink)'
                  }`}
                >
                  {letter}
                </button>
              );
            })}
          </div>
          <p className="theme-fade mt-[1.5vmin] text-[2.2vmin] text-(--face-ink-muted)">
            {cfg.gentleWakeMinutes > 0
              ? `Gentle wake ${cfg.gentleWakeMinutes} min · snooze ${cfg.snoozeMinutes} min`
              : `Snooze ${cfg.snoozeMinutes} min`}
          </p>
          <div className="mt-[3vmin] flex gap-[2vmin]">
            <button
              type="button"
              onClick={() => {
                persistEdit(view);
                setView({ kind: 'list' });
              }}
              className="theme-fade rounded-full bg-(--face-ink) px-[3vmin] py-[1vmin] text-[2.6vmin] text-(--face-bg)"
            >
              Done
            </button>
            {view.id !== null && (
              <button
                type="button"
                onClick={() => {
                  const id = view.id as string;
                  cancelSnooze(id);
                  useAlarms.getState().remove(id);
                  setView({ kind: 'list' });
                }}
                className="theme-fade rounded-full border border-(--face-ghost) px-[3vmin] py-[1vmin] text-[2.6vmin] text-(--face-ink)"
              >
                Delete
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (view.kind === 'list') {
    const sorted = [...alarms].sort((a, b) => a.time.localeCompare(b.time));
    return (
      <div className="theme-fade h-full w-full bg-(--face-bg) pt-[12vmin]">
        <RoundList<Alarm | typeof ADD>
          items={[...sorted, ADD]}
          header={<p className="theme-fade mb-[2vmin] text-[2.2vmin] text-(--face-ink-muted)">Alarms</p>}
          empty={<p className="text-[2.2vmin] text-(--face-ink-muted)">No alarms</p>}
          onSelect={(item) => startEdit(item === ADD ? null : item)}
          renderItem={(item) =>
            item === ADD ? (
              <div className="flex h-full items-center justify-center">
                <span className="rounded-full border border-(--face-ghost) px-[3vmin] py-[1vmin] text-[2.6vmin] text-(--face-ink)">
                  Add alarm
                </span>
              </div>
            ) : (
              <div className="flex h-full items-center justify-between gap-[2vmin]">
                <span
                  className={`theme-fade text-[2.6vmin] tabular-nums ${item.enabled ? 'text-(--face-ink)' : 'text-(--face-ink-muted)'}`}
                >
                  {item.time}
                </span>
                <Pills days={item.days} />
                <ArmedSwitch on={item.enabled} label={`Alarm ${item.time}`} onToggle={() => toggleAlarm(item)} />
              </div>
            )
          }
        />
      </div>
    );
  }

  if (alarms.length === 0) {
    return (
      <div className="theme-fade flex h-full w-full flex-col items-center justify-center bg-(--face-bg) text-center">
        <span className="flex h-[17vmin] w-[17vmin] items-center justify-center rounded-full border-2 border-(--face-ghost)">
          <AlarmClock aria-hidden="true" strokeWidth={1.5} className="h-[7vmin] w-[7vmin] text-(--face-ink-muted)" />
        </span>
        <p className="theme-fade mt-[3vmin] text-[4.2vmin] font-medium text-(--face-ink)">No alarms</p>
        <button
          type="button"
          onClick={() => startEdit(null)}
          className="theme-fade mt-[2.5vmin] rounded-full border border-(--face-ghost) px-[4vmin] py-[1.2vmin] text-[3vmin] text-(--face-ink)"
        >
          Add alarm
        </button>
      </div>
    );
  }

  const next = nextAlarm(alarms, new Date(now));
  if (!next) {
    return (
      <div className="theme-fade flex h-full w-full flex-col items-center justify-center gap-[1.5vmin] bg-(--face-bg) text-center">
        <p className="theme-fade text-[4.2vmin] font-medium text-(--face-ink)">All alarms off</p>
        <p className="theme-fade mt-[1vmin] text-[2.8vmin] text-(--face-ink-muted)">Turn one on in the list</p>
      </div>
    );
  }
  return (
    <div className="theme-fade flex h-full w-full flex-col items-center justify-center bg-(--face-bg) text-center">
      <p className="theme-fade text-[2.2vmin] text-(--face-ink-muted)">Next alarm</p>
      <span className="theme-fade mt-[1.5vmin] text-[17vmin] leading-none tabular-nums text-(--face-ink)">{next.alarm.time}</span>
      <p className="theme-fade mt-[1.5vmin] text-[2.6vmin] text-(--face-ink-muted)">{untilLabel(next.at - now)}</p>
      <Pills days={next.alarm.days} className="mt-[3vmin]" />
      <div className="mt-[3vmin] flex flex-col items-center gap-[1vmin]">
        <ArmedSwitch on label={`Alarm ${next.alarm.time}`} onToggle={() => toggleAlarm(next.alarm)} />
        <span className="theme-fade text-[2.2vmin] text-(--face-ink-muted)">Armed</span>
      </div>
    </div>
  );
}
