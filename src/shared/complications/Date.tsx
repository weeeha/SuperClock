import { useEffect, useState } from 'react';
import type { DateComplicationConfig } from '../schemas/complication.date';

interface Props {
  config?: Partial<DateComplicationConfig>;
}

function format(now: Date, mode: DateComplicationConfig['format']): string {
  if (mode === 'iso') return now.toISOString().slice(0, 10);
  if (mode === 'weekday-day') {
    return now.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' });
  }
  return now.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

export default function DateComplication({ config }: Props) {
  const mode = config?.format ?? 'day-month';
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const tick = () => setNow(new Date());
    const id = window.setInterval(tick, 60_000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="flex h-full w-full items-center justify-center text-center font-mono uppercase">
      {format(now, mode)}
    </div>
  );
}
