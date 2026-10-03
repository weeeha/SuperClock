import { useEffect, useMemo, useRef, useState } from 'react';
import type { AppProps } from '../../core/types';
import { timerAppSchema } from '../../shared/schemas/app.timer';
import { useTimer } from './timer-store';
import { formatMMSS, formatMinutes } from './format';
import { MAX_MS } from './dial';
import TimerDial from './TimerDial';

// Ring geometry in the 1000-unit disc. r 380 keeps the visible ring inside the
// dial band (300 to 435), so touching it never starts an arc gesture.
const R = 380;
const C = 2 * Math.PI * R;
const LONG_PRESS_MS = 600;

type Tone = 'ink' | 'accent' | 'muted';
const TONE: Record<Tone, string> = {
  ink: 'stroke-(--face-ink)',
  accent: 'stroke-(--color-accent)',
  muted: 'stroke-(--face-ink-muted)',
};

/** fraction of the circle drawn clockwise from 12 (board frame 1): the arc
 *  stays anchored at 12 and its end retreats as time runs out. `draining`
 *  only animates the change, one step a second. */
function Ring({ fraction, tone, draining }: { fraction: number; tone: Tone; draining: boolean }) {
  const f = Math.min(1, Math.max(0, fraction));
  return (
    <svg viewBox="0 0 1000 1000" className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
      <circle cx="500" cy="500" r={R} strokeWidth="26" className="fill-none stroke-(--face-ghost)" />
      <circle
        cx="500"
        cy="500"
        r={R}
        strokeWidth="26"
        strokeDasharray={`${C * f} ${C}`}
        strokeDashoffset={0}
        transform="rotate(-90 500 500)"
        className={`fill-none ${TONE[tone]} ${draining ? 'transition-[stroke-dasharray] duration-1000 ease-linear' : ''}`}
      />
    </svg>
  );
}

/** Tap vs long-press on one target. The timeout is a one-shot, not a tick. */
function usePress(onTap: () => void, onLongPress: () => void) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longFired = useRef(false);
  const clear = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  return {
    onPointerDown: () => {
      longFired.current = false;
      clear();
      timer.current = setTimeout(() => {
        longFired.current = true;
        timer.current = null;
        onLongPress();
      }, LONG_PRESS_MS);
    },
    onPointerUp: () => {
      const wasPending = timer.current !== null;
      clear();
      if (wasPending && !longFired.current) onTap();
    },
    onPointerLeave: clear,
  };
}

/** Timer: set with the dial or a preset, start, swipe away; the core alert
 *  layer rings it from wherever the clock is when it runs out. */
export default function TimerApp({ isActive, config }: AppProps) {
  const cfg = useMemo(() => {
    const parsed = timerAppSchema.safeParse(config ?? {});
    return parsed.success ? parsed.data : timerAppSchema.parse({});
  }, [config]);
  const presets = useMemo(() => cfg.presets.map(Number), [cfg.presets]);
  const firstPresetMs = (presets[0] ?? 5) * 60_000;

  const state = useTimer((s) => s.state);
  const actions = useTimer.getState();

  // First run: the first preset. A store write from an effect, not a setState.
  useEffect(() => {
    if (state.status === 'idle' && state.durationMs === 0) actions.setDuration(firstPresetMs);
  }, [state, firstPresetMs, actions]);

  // A running timer whose alert was cleared some other way returns to idle.
  useEffect(() => {
    actions.reconcile();
  }, [state, actions]);

  const [now, setNow] = useState(() => Date.now());
  const [wasActive, setWasActive] = useState(isActive);
  if (isActive !== wasActive) {
    setWasActive(isActive);
    if (isActive) setNow(Date.now()); // catch up after being swiped away
  }

  // The per-second readout: only while active and running (KIO-1).
  useEffect(() => {
    if (!isActive || state.status !== 'running') return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [isActive, state.status]);

  const start = () => {
    actions.start(cfg.sound);
    setNow(Date.now());
  };
  const runningPress = usePress(
    () => actions.pause(),
    () => actions.reset(),
  );
  const pausedPress = usePress(
    () => {
      actions.resume(cfg.sound);
      setNow(Date.now());
    },
    () => actions.reset(),
  );

  if (state.status === 'running' || state.status === 'paused') {
    const running = state.status === 'running';
    const remaining = running ? Math.max(0, state.endsAt - now) : state.remainingMs;
    const fraction = state.durationMs > 0 ? remaining / state.durationMs : 0;
    const press = running ? runningPress : pausedPress;
    const ink = running ? 'text-(--face-ink)' : 'text-(--face-ink-muted)';
    return (
      <div className="theme-fade relative flex h-full w-full items-center justify-center bg-(--face-bg)">
        <Ring fraction={fraction} tone={running ? 'accent' : 'muted'} draining />
        <button
          type="button"
          aria-label={running ? 'Pause timer' : 'Resume timer'}
          className="relative flex flex-col items-center text-center"
          {...press}
        >
          <span className={`theme-fade text-[17vmin] leading-none tabular-nums ${ink}`}>{formatMMSS(remaining)}</span>
          <span className="theme-fade mt-[1.5vmin] text-[2.2vmin] text-(--face-ink-muted)">
            {running ? `of ${formatMinutes(state.durationMs)}` : 'Paused'}
          </span>
        </button>
      </div>
    );
  }

  const durationMs = state.durationMs || firstPresetMs;
  return (
    <div className="theme-fade relative flex h-full w-full items-center justify-center bg-(--face-bg)">
      <Ring fraction={durationMs / MAX_MS} tone="ink" draining={false} />
      <TimerDial durationMs={durationMs} onChange={actions.setDuration} />
      <div className="relative flex flex-col items-center text-center">
        <p className="theme-fade text-[2.2vmin] text-(--face-ink-muted)">Set timer</p>
        <button
          type="button"
          aria-label="Start timer"
          onClick={start}
          className="theme-fade mt-[1.5vmin] text-[17vmin] leading-none tabular-nums text-(--face-ink)"
        >
          {formatMMSS(durationMs)}
        </button>
        <div className="mt-[3vmin] flex gap-[1.5vmin]">
          {presets.map((m) => {
            const selected = durationMs === m * 60_000;
            return (
              <button
                key={m}
                type="button"
                aria-pressed={selected}
                onClick={() => actions.setDuration(m * 60_000)}
                className={`theme-fade rounded-full border px-[2.4vmin] py-[1vmin] text-[2.6vmin] ${
                  selected
                    ? 'border-transparent bg-(--face-ink) text-(--face-bg)'
                    : 'border-(--face-ghost) text-(--face-ink)'
                }`}
              >
                {m} min
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
