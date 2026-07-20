import { useEffect, useState } from 'react';
import { useRadar } from '../radar';
import { useDeviceConfig } from '../device-config';
import { DEFAULT_ABSENT_AFTER_MIN } from '../../shared/radar';

// Re-check the absence duration this often; presence *transitions* arrive
// over SSE and re-render immediately, this tick only ages the timeout.
const ABSENCE_TICK_MS = 10_000;

// Client half of presence wake/sleep: fades the kiosk to black once the
// radar has reported nobody around for absentAfterMin. The server's
// display-adapter powers the physical panel off on the same threshold; this
// shade makes the behavior visible instantly (and in dev, where there is no
// wlr-randr). It never blocks input — gestures still land underneath.
export default function PresenceShade() {
  const radar = useRadar();
  const config = useDeviceConfig();

  const enabled =
    radar?.available === true && config?.settings.presence?.enabled !== false;
  const absentAfterMin =
    config?.settings.presence?.absentAfterMin ?? DEFAULT_ABSENT_AFTER_MIN;

  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    if (!enabled) return;
    const timer = window.setInterval(() => setNowMs(Date.now()), ABSENCE_TICK_MS);
    return () => window.clearInterval(timer);
  }, [enabled]);

  let shaded = false;
  if (enabled && radar && radar.present === false) {
    const lastSeenMs = radar.lastPresentAt ? Date.parse(radar.lastPresentAt) : 0;
    shaded = nowMs - lastSeenMs >= Math.max(1, absentAfterMin) * 60_000;
  }

  return (
    <div
      aria-hidden
      className={`pointer-events-none fixed inset-0 z-[9000] bg-black transition-opacity duration-1000 ${
        shaded ? 'opacity-100' : 'opacity-0'
      }`}
    />
  );
}
