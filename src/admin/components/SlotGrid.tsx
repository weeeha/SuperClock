import { useState } from 'react';
import { getComplication } from '../../shared/complication-registry';
import type { ComplicationSlot } from '../../shared/types';
import { ComplicationPicker } from './ComplicationPicker';

interface Props {
  slots: ComplicationSlot[];
  values: Record<string, { id: string } | undefined>;
  onChange: (next: Record<string, { id: string } | undefined>) => void;
}

export function SlotGrid({ slots, values, onChange }: Props) {
  const [openSlot, setOpenSlot] = useState<ComplicationSlot | null>(null);

  if (slots.length === 0) {
    return (
      <p className="text-sm opacity-60">
        This face has no complication slots yet.
      </p>
    );
  }

  return (
    <>
      <ul className="divide-y divide-[hsl(var(--border))]">
        {slots.map((slot) => {
          const value = values[slot.id];
          const comp = value ? getComplication(value.id) : null;
          return (
            <li key={slot.id}>
              <button
                onClick={() => setOpenSlot(slot)}
                className="flex w-full items-center justify-between py-3 hover:bg-[hsl(var(--muted))]/30"
              >
                <span className="text-sm capitalize">{slot.id.replace(/-/g, ' ')}</span>
                <span className="flex items-center gap-2 text-sm text-[hsl(var(--muted-foreground))]">
                  {comp?.name ?? 'None'}
                  <span aria-hidden>›</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {openSlot && (
        <ComplicationPicker
          open
          onClose={() => setOpenSlot(null)}
          slotId={openSlot.id}
          shape={openSlot.shape}
          current={values[openSlot.id]?.id ?? null}
          onPick={(complicationId) => {
            const next = { ...values };
            if (complicationId === null) delete next[openSlot.id];
            else next[openSlot.id] = { id: complicationId };
            onChange(next);
          }}
        />
      )}
    </>
  );
}
