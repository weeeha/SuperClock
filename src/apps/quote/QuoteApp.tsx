import { useEffect, useMemo, useRef, useState } from 'react';
import type { AppProps } from '../../core/types';
import { quoteAppSchema } from '../../shared/schemas/app.quote';
import type { QuoteAppConfig } from '../../shared/schemas/app.quote';
import { quotes } from './quotes';

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function hueOf(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return h % 360;
}

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

/** Quote of the Day — based on Figma S16 design (489:21143). Tap to cycle. */
export default function QuoteApp({ isActive, config }: AppProps) {
  const cfg = useMemo(() => {
    const parsed = quoteAppSchema.safeParse(config ?? {});
    return parsed.success ? parsed.data : quoteAppSchema.parse({});
  }, [config]);
  // `source: 'url'` is not implemented — a remote list needs a fetch hook with
  // an honest offline tell, so every source falls back to the built-in quotes.
  // `theme` is likewise unused: colors come from the global --face-* tokens
  // and this component has no local theming hook.

  const [scheduled, setScheduled] = useState(() => scheduledIndex(cfg.rotation));
  const [visit, setVisit] = useState(visitSerial);
  const [offset, setOffset] = useState(0); // tap-to-next steps past the base quote
  const [failedIndex, setFailedIndex] = useState<number | null>(null);

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
  const initials = useMemo(() => initialsOf(quote.author), [quote.author]);
  const hue = useMemo(() => hueOf(quote.author), [quote.author]);
  const fallbackBg = `linear-gradient(135deg, hsl(${hue} 55% 55%), hsl(${(hue + 40) % 360} 60% 40%))`;
  const showImg = quote.portrait && failedIndex !== index;

  // Length-based type scale so long quotes fit the round display; the author
  // portrait gives up a step on the smallest tier to make room.
  const len = quote.text.length;
  const quoteSize = len > 140 ? 'text-[3.2vmin]' : len > 60 ? 'text-[4vmin]' : 'text-[5vmin]';
  const portraitSize = len > 140 ? 'h-[16%] w-[16%]' : 'h-[22%] w-[22%]';

  return (
    <div
      onClick={() => setOffset((o) => o + 1)}
      className="theme-fade flex h-full w-full flex-col items-center justify-center bg-(--face-bg) p-[12%] gap-[4%] cursor-pointer select-none"
    >
      {/* Author portrait — Wikipedia thumbnail, initials-gradient fallback */}
      <div
        className={`flex ${portraitSize} items-center justify-center overflow-hidden rounded-full text-white font-semibold`}
        style={!showImg ? { background: fallbackBg, fontSize: '6vmin' } : undefined}
      >
        {showImg ? (
          <img
            src={quote.portrait}
            alt={quote.author}
            referrerPolicy="no-referrer"
            onError={() => setFailedIndex(index)}
            className="h-full w-full object-cover"
          />
        ) : (
          initials
        )}
      </div>

      {/* Author name */}
      <p className="theme-fade text-[3.5vmin] text-(--face-ink-muted)">{quote.author}</p>

      {/* Quote text */}
      <p
        className={`theme-fade ${quoteSize} font-semibold text-center leading-snug text-(--face-ink)`}
      >
        "{quote.text}"
      </p>
    </div>
  );
}
