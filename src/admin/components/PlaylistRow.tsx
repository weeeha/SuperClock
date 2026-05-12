import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, X } from 'lucide-react';
import { getFace } from '../../shared/face-registry';
import type { ScreenInstance } from '../../shared/types';

interface Props {
  index: number;
  instance: ScreenInstance;
  onRemove: (id: string) => void;
}

const APP_LABEL: Record<string, string> = {
  clock: 'Clock',
  weather: 'Weather',
  calendar: 'Calendar',
  fitness: 'Fitness',
  github: 'GitHub',
  habits: 'Habits',
  fireplace: 'Fireplace',
  'photo-frame': 'Photo Frame',
  quote: 'Quote',
  'time-tracking': 'Time Tracking',
};

export function PlaylistRow({ index, instance, onRemove }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: instance.id,
  });

  const faceId = typeof instance.config?.faceId === 'string' ? instance.config.faceId : undefined;
  const face = faceId ? getFace(faceId) : undefined;
  const name = instance.label ?? face?.name ?? APP_LABEL[instance.appId] ?? instance.appId;
  const subtitle = instance.appId === 'clock' ? face?.name ?? faceId : APP_LABEL[instance.appId];

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
      }}
      className="flex items-center gap-3 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-2"
    >
      <span className="w-6 text-center text-sm font-mono opacity-50">{index + 1}</span>
      {face?.preview ? (
        <img src={face.preview} alt="" className="h-12 w-12 rounded-md object-cover" />
      ) : (
        <div className="flex h-12 w-12 items-center justify-center rounded-md bg-[hsl(var(--muted))] text-xs uppercase opacity-60">
          {instance.appId.slice(0, 3)}
        </div>
      )}
      <div className="flex flex-1 flex-col">
        <span className="text-sm font-medium">{name}</span>
        {subtitle && name !== subtitle && (
          <span className="text-xs opacity-60">{subtitle}</span>
        )}
      </div>
      <button
        onClick={() => onRemove(instance.id)}
        aria-label="Remove from playlist"
        className="rounded-md p-1 opacity-60 hover:bg-[hsl(var(--muted))] hover:opacity-100"
      >
        <X className="h-4 w-4" />
      </button>
      <button
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder"
        className="cursor-grab rounded-md p-1 opacity-60 hover:bg-[hsl(var(--muted))] hover:opacity-100 active:cursor-grabbing"
      >
        <GripVertical className="h-4 w-4" />
      </button>
    </div>
  );
}
