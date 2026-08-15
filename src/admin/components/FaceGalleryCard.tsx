import type { FaceDescriptor } from '../../shared/types';

interface Props {
  face: FaceDescriptor;
  onPick: (face: FaceDescriptor) => void;
  /** Writes disabled (offline / read-only clock / add in flight). */
  disabled?: boolean;
}

// Gallery tile (wf/10): static registry art in P1 — live previews are P2.
export function FaceGalleryCard({ face, onPick, disabled }: Props) {
  return (
    <button
      type="button"
      onClick={() => onPick(face)}
      disabled={disabled}
      className="flex flex-col gap-2 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-3 text-left transition-colors hover:bg-[hsl(var(--muted))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] disabled:pointer-events-none disabled:opacity-50"
    >
      <span
        aria-hidden
        className="block aspect-square w-full overflow-hidden rounded-md bg-[hsl(var(--muted))]"
      >
        <img src={face.preview} alt="" className="h-full w-full object-cover" />
      </span>
      <span className="block min-w-0">
        <span className="block truncate text-sm font-medium">{face.name}</span>
        {face.category && (
          <span className="block text-xs capitalize opacity-60">{face.category}</span>
        )}
      </span>
    </button>
  );
}
