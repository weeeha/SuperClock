import { useEffect, useMemo, useState } from 'react';
import type { AppProps } from '../../core/types';
import { useNavigation } from '../../core/navigation';
import { weatherAppSchema } from '../../shared/schemas/app.weather';
import { useWeather } from './useWeather';
import { dialFor } from './dials';
import Dial from './Dial';
import NowPage from './NowPage';
import FieldsWeather, { FieldsWeatherMetric } from './FieldsWeather';
import { useSkin } from '../../core/skin';
import PageDots from '../../core/widgets/PageDots';

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

  // The raw config goes in, not `cfg`: resolveWeatherQuery has to distinguish
  // "operator chose celsius" from "operator chose nothing", and zod's
  // `.default()` erases that difference (see weather-config.ts).
  const { model, label, offline, updatedAt, unconfigured } = useWeather(config, isActive);
  // Fields skin: every page has a Fields renderer (Now, plus the dial pages).
  const fields = useSkin() === 'fields';

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
    const cb = (dir: 'up' | 'down') => {
      if (dir === 'up') {
        setPage((p) => Math.min(p + 1, pages.length - 1));
      } else if (safePage > 0) {
        setPage((p) => Math.max(p - 1, 0));
      } else {
        showGrid();
      }
    };
    setVerticalSwipeCallback(cb);
    return () => {
      // popLayout keeps the exiting app mounted after the next app registers —
      // only clear the slot if it's still ours (HabitsApp's guarded cleanup).
      if (useNavigation.getState().verticalSwipeCallback === cb) setVerticalSwipeCallback(null);
    };
  }, [isActive, safePage, pages.length, setVerticalSwipeCallback, showGrid]);

  // A kiosk never swipes itself home. Without this, checking the UV dial on
  // Tuesday leaves UV on screen until Friday.
  useEffect(() => {
    if (!isActive || safePage === 0 || cfg.idleReturnSeconds === 0) return;
    const id = setTimeout(() => setPage(0), cfg.idleReturnSeconds * 1000);
    return () => clearTimeout(id);
  }, [isActive, safePage, cfg.idleReturnSeconds]);

  const fieldsNow = (
    <FieldsWeather model={model} label={label} offline={offline} updatedAt={updatedAt}
                   unconfigured={unconfigured} page={safePage} pageCount={pages.length} />
  );

  // The Fields skin paints its own disc from --fields-weather*; the wrapper
  // behind it is the palette surface like every other app (SUR-1), so the
  // corners, visible only on the square device, follow day and night.
  if (fields && (!model || pages[safePage] === 'now')) {
    return <div className="relative h-full w-full overflow-hidden bg-(--face-bg)">{fieldsNow}</div>;
  }
  if (fields && model) {
    const metricPage = pages[safePage];
    if (metricPage !== 'now') {
      return (
        <div className="relative h-full w-full overflow-hidden bg-(--face-bg)">
          <FieldsWeatherMetric page={metricPage} model={model} label={label} offline={offline}
                               updatedAt={updatedAt} pageIndex={safePage} pageCount={pages.length} />
        </div>
      );
    }
  }

  if (!model) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-(--face-bg)">
        <span className="font-mono text-[3vmin] text-(--face-tick)">
          {unconfigured ? 'Set a location in the admin' : offline ? 'weather offline' : 'loading…'}
        </span>
      </div>
    );
  }

  const current = pages[safePage];
  const dial = current === 'now' ? null : dialFor(current, model);

  return (
    <div className="relative h-full w-full overflow-hidden bg-(--face-bg)">
      {current === 'now'
        ? <NowPage model={model} label={label} now={now} />
        : dial && <Dial {...dial} />}

      {offline && (
        <span className="absolute left-1/2 top-[12%] -translate-x-1/2 font-mono text-[2.4vmin] text-(--face-tick)">
          offline
        </span>
      )}

      <div className="text-(--face-ink)">
        <PageDots count={pages.length} index={safePage} />
      </div>
    </div>
  );
}
