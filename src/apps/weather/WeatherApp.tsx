import { useEffect, useMemo, useState } from 'react';
import type { AppProps } from '../../core/types';
import { useNavigation } from '../../core/navigation';
import { weatherAppSchema } from '../../shared/schemas/app.weather';
import { useWeather } from './useWeather';
import { dialFor } from './dials';
import Dial from './Dial';
import NowPage from './NowPage';

export default function WeatherApp({ isActive, config }: AppProps) {
  // safeParse, not parse: a malformed fleet config must not white-screen a
  // wall-mounted kiosk. Fall back to schema defaults and keep rendering.
  const cfg = useMemo(() => {
    const result = weatherAppSchema.safeParse(config ?? {});
    if (result.success) return result.data;
    console.warn('Invalid weather config, using defaults:', result.error.message);
    return weatherAppSchema.parse({});
  }, [config]);

  const pages = cfg.pages;

  const [page, setPage] = useState(0);
  const [now, setNow] = useState(new Date());
  const setVerticalSwipeCallback = useNavigation((s) => s.setVerticalSwipeCallback);
  const showGrid = useNavigation((s) => s.showGrid);

  const { model, label, offline } = useWeather(cfg.location, cfg.unit, isActive);

  // A trimmed page list (config pushed mid-session) can strand `page` past
  // the new end — clamp on read rather than syncing it back via an effect
  // (the react-hooks Compiler ruleset flags setState-in-effect for values
  // that are just a derivation of existing state/props).
  const safePage = Math.min(page, pages.length - 1);

  // Only HH:MM is rendered — returning the previous state when the minute is
  // unchanged skips the re-render, so this ticks the tree once a minute
  // instead of once a second (real heat on a Pi).
  useEffect(() => {
    if (!isActive) return;
    const id = setInterval(() => {
      setNow((prev) => {
        const n = new Date();
        return n.getMinutes() === prev.getMinutes() && n.getHours() === prev.getHours()
          ? prev
          : n;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [isActive]);

  // Vertical swipe cycles pages; swipe-down on page 0 falls through to the
  // shell's default gesture. Same mechanism as HabitsApp.
  useEffect(() => {
    if (!isActive) {
      setVerticalSwipeCallback(null);
      return;
    }
    setVerticalSwipeCallback((dir) => {
      if (dir === 'up') {
        setPage((p) => Math.min(p + 1, pages.length - 1));
      } else if (safePage > 0) {
        setPage((p) => Math.max(p - 1, 0));
      } else {
        showGrid();
      }
    });
    return () => setVerticalSwipeCallback(null);
  }, [isActive, safePage, pages.length, setVerticalSwipeCallback, showGrid]);

  // A kiosk never swipes itself home. Without this, checking the UV dial on
  // Tuesday leaves UV on screen until Friday.
  useEffect(() => {
    if (!isActive || safePage === 0 || cfg.idleReturnSeconds === 0) return;
    const id = setTimeout(() => setPage(0), cfg.idleReturnSeconds * 1000);
    return () => clearTimeout(id);
  }, [isActive, safePage, cfg.idleReturnSeconds]);

  if (!model) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-black">
        <span className="font-mono text-[3vmin] text-white/40">
          {offline ? 'weather offline' : 'loading…'}
        </span>
      </div>
    );
  }

  const current = pages[safePage];
  const dial = current === 'now' ? null : dialFor(current, model);

  return (
    <div className="relative h-full w-full overflow-hidden bg-black">
      {current === 'now'
        ? <NowPage model={model} label={label} now={now} />
        : dial && <Dial {...dial} />}

      {offline && (
        <span className="absolute left-1/2 top-[12%] -translate-x-1/2 font-mono text-[2.4vmin] text-white/30">
          offline
        </span>
      )}

      <div className="pointer-events-none absolute bottom-[3.5%] left-1/2 flex -translate-x-1/2 gap-2">
        {pages.map((id, i) => (
          <div
            key={id}
            className={`h-1.5 w-1.5 rounded-full transition-colors ${i === safePage ? 'bg-white' : 'bg-white/25'}`}
          />
        ))}
      </div>
    </div>
  );
}
