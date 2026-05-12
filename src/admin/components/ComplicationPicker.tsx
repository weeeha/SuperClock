import { Dialog } from './ui/dialog';
import { complicationsForShape } from '../../shared/complication-registry';
import type { ComplicationShape } from '../../shared/types';

interface Props {
  open: boolean;
  onClose: () => void;
  slotId: string;
  shape: ComplicationShape;
  current: string | null;
  onPick: (complicationId: string | null) => void;
}

export function ComplicationPicker({ open, onClose, slotId, shape, current, onPick }: Props) {
  const options = complicationsForShape(shape);
  return (
    <Dialog open={open} onClose={onClose} title={`${slotId} — ${shape}`}>
      <div className="space-y-1">
        <button
          onClick={() => {
            onPick(null);
            onClose();
          }}
          className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-sm hover:bg-[hsl(var(--muted))] ${
            current === null ? 'font-semibold' : ''
          }`}
        >
          <span className="opacity-60">None</span>
          {current === null && <span className="text-xs">●</span>}
        </button>
        {options.map((c) => (
          <button
            key={c.id}
            onClick={() => {
              onPick(c.id);
              onClose();
            }}
            className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-sm hover:bg-[hsl(var(--muted))] ${
              current === c.id ? 'font-semibold' : ''
            }`}
          >
            <span>{c.name}</span>
            {current === c.id && <span className="text-xs">●</span>}
          </button>
        ))}
        {options.length === 0 && (
          <p className="px-3 py-2 text-sm opacity-60">No complications fit this slot shape.</p>
        )}
      </div>
    </Dialog>
  );
}
