import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import type { AppProps } from '../../core/types';
import { useIsNight } from '../../core/apply-settings';
import { aiFaceAppSchema } from '../../shared/schemas/app.ai-face';
import { AVATAR_DESIGNS, findDesign } from '../../shared/ai-face-designs';
import AvatarFrame from './AvatarFrame';
import { applyNight, sourceFor, toExternalStore } from './sources';

const noopSubscribe = () => () => {};

export default function AiFaceApp({ isActive, config }: AppProps) {
  const parsed = aiFaceAppSchema.safeParse(config ?? {});
  const cfg = parsed.success ? parsed.data : aiFaceAppSchema.parse({});
  const design = findDesign(cfg.design) ?? AVATAR_DESIGNS[0];

  const store = useMemo(
    () => toExternalStore(sourceFor({ source: cfg.source, activity: cfg.activity, expression: cfg.expression })),
    [cfg.source, cfg.activity, cfg.expression],
  );
  // Subscribing starts the demo interval, so only an active face subscribes.
  const raw = useSyncExternalStore(isActive ? store.subscribe : noopSubscribe, store.getSnapshot);
  const state = applyNight(raw, useIsNight(), cfg.sleepAtNight);

  return (
    <div className="relative h-full w-full bg-black">
      <AvatarFrame design={design} state={state} active={isActive} />
      {cfg.showTime && <TimeLabel active={isActive} />}
      {cfg.source === 'demo' && (
        <span className="absolute inset-x-0 top-[12%] text-center text-[2vmin] opacity-60 text-[hsl(var(--sheet-ink))]">Demo</span>
      )}
    </div>
  );
}

const fmt = (d: Date) => d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

function TimeLabel({ active }: { active: boolean }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (!active) return;
    let id: ReturnType<typeof setTimeout>;
    const tick = () => {
      setNow(new Date());
      id = setTimeout(tick, 60_000 - (Date.now() % 60_000) + 25);
    };
    id = setTimeout(tick, 60_000 - (Date.now() % 60_000) + 25);
    return () => clearTimeout(id);
  }, [active]);
  return (
    <span
      data-testid="ai-face-time"
      className="absolute inset-x-0 bottom-[10%] text-center text-[3vmin] tabular-nums text-[hsl(var(--sheet-ink))]"
    >
      {fmt(now)}
    </span>
  );
}
