import type { TemperatureComplicationConfig } from '../schemas/complication.temperature';

interface Props {
  config?: Partial<TemperatureComplicationConfig>;
  // Real wiring to weather data lands when a face with this slot ships.
  // For now this renders a placeholder so the slot is visible in the admin.
  value?: { tempC: number | null; condition?: string };
}

export default function TemperatureComplication({ config, value }: Props) {
  const unit = config?.unit ?? 'celsius';
  const showCondition = config?.showCondition ?? true;
  const temp = value?.tempC == null
    ? '—'
    : unit === 'fahrenheit'
      ? Math.round(value.tempC * 9 / 5 + 32)
      : Math.round(value.tempC);

  return (
    <div className="flex h-full w-full flex-col items-center justify-center font-mono">
      <span className="text-2xl leading-none">
        {temp}
        <span className="text-base">°</span>
      </span>
      {showCondition && value?.condition && (
        <span className="mt-0.5 text-[10px] uppercase opacity-70">
          {value.condition}
        </span>
      )}
    </div>
  );
}
