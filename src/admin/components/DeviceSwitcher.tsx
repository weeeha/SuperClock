import { useState } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { ALL_DEVICE_IDS, type DeviceId } from '../../shared/types';
import { useActiveDevice } from '../store/active-device';
import { cn } from '../lib/cn';

const LABELS: Record<DeviceId, string> = {
  'superclock-fast': 'Fast',
  'superclock-small': 'Small',
  'superclock-square': 'Square',
  'superclock-slow': 'Slow',
};

export function DeviceSwitcher() {
  const { activeDeviceId, setActiveDevice } = useActiveDevice();
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-1.5 text-sm hover:bg-[hsl(var(--muted))]"
      >
        <span className="font-medium">{LABELS[activeDeviceId]}</span>
        <ChevronDown className="h-4 w-4 opacity-60" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-20 mt-1 w-48 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--popover))] p-1 shadow-lg">
            {ALL_DEVICE_IDS.map((id) => (
              <button
                key={id}
                onClick={() => {
                  setActiveDevice(id);
                  setOpen(false);
                }}
                className={cn(
                  'flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-sm hover:bg-[hsl(var(--muted))]',
                  id === activeDeviceId && 'font-semibold',
                )}
              >
                <span>{LABELS[id]}</span>
                {id === activeDeviceId && <Check className="h-4 w-4" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
