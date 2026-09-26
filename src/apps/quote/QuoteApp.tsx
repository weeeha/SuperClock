import { useEffect, useMemo, useRef, useState } from 'react';
import type { AppProps } from '../../core/types';
import { quoteAppSchema } from '../../shared/schemas/app.quote';
import type { QuoteAppConfig } from '../../shared/schemas/app.quote';
import { quotes } from './quotes';

/** Deterministic index for the current calendar day (and hour, when hourly). */
function scheduledIndex(rotation: QuoteAppConfig['rotation'], now = new Date()): number {
  const dayOfYear = Math.floor(
    (now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86400000,
  );
  const period = rotation === 'hourly' ? dayOfYear * 24 + now.getHours() : dayOfYear;
  return period % quotes.length;
}

// 'every-visit' pointer. Module scope because SwipeContainer unmounts apps on
// swipe-away — component state would reset to the same quote on every visit.
let visitSerial = 0;

/** Quote of the Day. The line is the whole screen: set at one of two sizes
 *  depending on its length, with the author below it. Tap to move on. */
export default function QuoteApp({ isActive, config }: AppProps) {
  const cfg = useMemo(() => {
    const parsed = quoteAppSchema.safeParse(config ?? {});
    return parsed.success ? parsed.data : quoteAppSchema.parse({});
  }, [config]);
  // `source: 'url'` is not implemented — a remote list needs a fetch hook with
  // an honest offline tell, so every source falls back to the built-in quotes.
  // `theme` is likewise unused: the face reads the global --face-* roles, so it
  // follows the device's day/night palette rather than a per-app setting. Both
  // say so in their schema meta.

  const [scheduled, setScheduled] = useState(() => scheduledIndex(cfg.rotation));
  const [visit, setVisit] = useState(visitSerial);
  const [offset, setOffset] = useState(0); // tap-to-next steps past the base quote

  // daily/hourly: re-derive the scheduled quote at day/hour boundaries.
  // Same-value setState bails out, so the minute cadence is free in between.
  useEffect(() => {
    if (!isActive || cfg.rotation === 'every-visit') return;
    const tick = () => setScheduled(scheduledIndex(cfg.rotation));
    tick(); // catch boundaries crossed while inactive
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, [isActive, cfg.rotation]);

  // every-visit: advance once per activation (mount-while-active or grid-close
  // reactivation). `counted` keeps the effect idempotent per activation —
  // StrictMode re-runs mount effects in dev.
  const counted = useRef(false);
  useEffect(() => {
    if (!isActive || cfg.rotation !== 'every-visit') {
      counted.current = false;
      return;
    }
    if (counted.current) return;
    counted.current = true;
    const tick = () => setVisit((visitSerial += 1));
    tick();
  }, [isActive, cfg.rotation]);

  const base = cfg.rotation === 'every-visit' ? visit : scheduled;
  const index = (base + offset) % quotes.length;
  const quote = quotes[index];

  // Two sizes, not a per-string scale: the library is capped at 140 characters
  // so the long tier always fits the disc without a third step.
  const quoteSize = quote.text.length > 70 ? 'text-[4.2vmin]' : 'text-[5.4vmin]';

  return (
    <button
      type="button"
      aria-label="Next quote"
      onClick={() => setOffset((o) => o + 1)}
      className="theme-fade flex h-full w-full cursor-pointer select-none flex-col items-center justify-center bg-(--face-bg) px-[13%] text-center"
    >
      {/* Keyed on the quote so a tap remounts the group and replays the
          dissolve; the animation is the only feedback a tap gets. */}
      <div key={index} className="dissolve-in flex flex-col items-center gap-[3vmin]">
        <p className={`theme-fade ${quoteSize} font-semibold leading-snug text-balance text-(--face-ink)`}>
          {quote.text}
        </p>
        <p className="theme-fade text-[2.6vmin] text-(--face-ink-muted)">{quote.author}</p>
      </div>
    </button>
  );
}
