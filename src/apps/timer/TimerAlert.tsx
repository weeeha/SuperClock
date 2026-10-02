import type { AlertViewProps } from '../../core/alerts/views';
import { useTimer } from './timer-store';
import { formatClock } from './format';

/** Board frames 2 and 4: "00:00 · Time's up" pulsing for five minutes, then a
 *  still "Done at 12:41". A tap anywhere clears it. */
export default function TimerAlert({ alert, phase, dismiss }: AlertViewProps) {
  const clear = () => {
    useTimer.getState().finish();
    dismiss();
  };

  if (phase === 'settled') {
    return (
      <button
        type="button"
        aria-label="Clear timer"
        onClick={clear}
        className="theme-fade flex h-full w-full flex-col items-center justify-center bg-(--face-bg) text-center"
      >
        <span className="text-[2.6vmin] font-medium text-(--face-ink-muted)">Done at</span>
        <span className="mt-[1.5vmin] text-[17vmin] leading-none tabular-nums text-(--face-ink-muted)">
          {formatClock(alert.firedAt)}
        </span>
        <span className="mt-[3vmin] text-[2.2vmin] text-(--face-ink-muted)">Tap to clear</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      aria-label="Dismiss timer"
      onClick={clear}
      className="alert-pulse flex h-full w-full flex-col items-center justify-center text-center"
    >
      <span className="text-[17vmin] leading-none tabular-nums">00:00</span>
      <span className="mt-[3vmin] text-[2.6vmin]">Time's up</span>
    </button>
  );
}
