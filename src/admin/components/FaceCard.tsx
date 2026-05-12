import { Link } from 'react-router-dom';
import { Minus } from 'lucide-react';
import { getFace } from '../../shared/face-registry';
import type { ScreenInstance } from '../../shared/types';

interface Props {
  instance: ScreenInstance;
  appId: string;
  onDelete: (id: string) => void;
}

export function FaceCard({ instance, appId, onDelete }: Props) {
  const faceId = typeof instance.config?.faceId === 'string' ? instance.config.faceId : undefined;
  const face = faceId ? getFace(faceId) : undefined;
  const label = instance.label ?? face?.name ?? faceId ?? 'Untitled';

  return (
    <div className="flex items-center gap-3 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-2">
      <button
        onClick={() => onDelete(instance.id)}
        aria-label="Remove face"
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--destructive))] text-[hsl(var(--destructive-foreground))] hover:opacity-90"
      >
        <Minus className="h-4 w-4" />
      </button>
      <Link
        to={`/apps/${appId}/faces/${instance.id}`}
        className="flex flex-1 items-center gap-3 rounded-sm hover:bg-[hsl(var(--muted))]/30"
      >
        {face?.preview && (
          <img
            src={face.preview}
            alt=""
            className="h-12 w-12 rounded-md object-cover"
          />
        )}
        <span className="text-sm font-medium">{label}</span>
      </Link>
    </div>
  );
}
