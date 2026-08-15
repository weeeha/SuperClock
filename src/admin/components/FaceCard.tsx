import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { getFace } from '../../shared/face-registry';
import type { ScreenInstance } from '../../shared/types';

interface Props {
  instance: ScreenInstance;
  /** Screen Config path for this instance (device-scoped absolute path). */
  to: string;
  inPlaylist: boolean;
}

// My-faces row (wf/6): thumb, label, face name, honest playlist membership.
// No delete affordance here — removal lives in Screen Config's danger row.
export function FaceCard({ instance, to, inPlaylist }: Props) {
  const faceId = typeof instance.config?.faceId === 'string' ? instance.config.faceId : undefined;
  const face = faceId ? getFace(faceId) : undefined;
  const label = instance.label ?? face?.name ?? faceId ?? 'Untitled';
  const subtitle = face && face.name !== label ? face.name : null;

  return (
    <Link
      to={to}
      className="flex items-center gap-3 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-3 transition-colors hover:bg-[hsl(var(--muted))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]"
    >
      <span
        aria-hidden
        className="h-12 w-12 shrink-0 overflow-hidden rounded-md bg-[hsl(var(--muted))]"
      >
        {face?.preview && (
          <img src={face.preview} alt="" className="h-full w-full object-cover" />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{label}</span>
        {subtitle && <span className="block truncate text-xs opacity-60">{subtitle}</span>}
        {inPlaylist && (
          <span className="mt-1 inline-block rounded-full bg-[hsl(var(--primary)/0.15)] px-2 py-0.5 text-xs text-[hsl(var(--primary))]">
            in playlist
          </span>
        )}
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 opacity-40" aria-hidden />
    </Link>
  );
}
