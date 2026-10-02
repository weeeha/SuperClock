import type { AppProps } from '../../core/types';
import { countdownAppSchema } from '../../shared/schemas/app.countdown';

// SCAFFOLD-TODO: implement CountdownApp. House rules that apply from day one:
// gate any setInterval/rAF on `isActive` (background apps must not tick),
// and if this app fetches, design the honest offline tell before the happy
// path (WeatherApp is the reference). Config arrives validated below (the
// Calendar pattern; the schema-liveness gate holds every app to it): read
// cfg.<field>, never props.config directly.
export default function CountdownApp({ isActive, config }: AppProps) {
  const parsed = countdownAppSchema.safeParse(config ?? {});
  const cfg = parsed.success ? parsed.data : countdownAppSchema.parse({});
  void isActive;
  void cfg; // SCAFFOLD-TODO: consume the config
  return (
    <div className="flex h-full w-full items-center justify-center">
      <span className="font-display text-2xl opacity-40">Countdown scaffold</span>
    </div>
  );
}
