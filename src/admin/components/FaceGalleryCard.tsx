import type { FaceDescriptor } from '../../shared/types';

interface Props {
  face: FaceDescriptor;
  onPick: (face: FaceDescriptor) => void;
}

export function FaceGalleryCard({ face, onPick }: Props) {
  return (
    <button
      onClick={() => onPick(face)}
      className="flex flex-col gap-2 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-3 text-left transition-colors hover:bg-[hsl(var(--muted))]"
    >
      <div className="aspect-square w-full overflow-hidden rounded-md bg-[hsl(var(--muted))]">
        <img src={face.preview} alt="" className="h-full w-full object-cover" />
      </div>
      <div className="space-y-0.5">
        <div className="text-sm font-medium">{face.name}</div>
        {face.category && (
          <div className="text-xs capitalize opacity-60">{face.category}</div>
        )}
      </div>
    </button>
  );
}
