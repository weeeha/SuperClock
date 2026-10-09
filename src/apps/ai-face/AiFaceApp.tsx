import type { AppProps } from '../../core/types';
import { aiFaceAppSchema } from '../../shared/schemas/app.ai-face';

// SCAFFOLD-TODO: implement AiFaceApp. House rules that apply from day one:
// gate any setInterval/rAF on `isActive` (background apps must not tick),
// and if this app fetches, design the honest offline tell before the happy
// path (WeatherApp is the reference). Config arrives validated below (the
// Calendar pattern; the schema-liveness gate holds every app to it): read
// cfg.<field>, never props.config directly.
export default function AiFaceApp({ isActive, config }: AppProps) {
  const parsed = aiFaceAppSchema.safeParse(config ?? {});
  const cfg = parsed.success ? parsed.data : aiFaceAppSchema.parse({});
  void isActive;
  void cfg; // SCAFFOLD-TODO: consume the config
  return (
    <div className="flex h-full w-full items-center justify-center">
      <span className="font-display text-2xl opacity-40">Ai Face scaffold</span>
    </div>
  );
}
