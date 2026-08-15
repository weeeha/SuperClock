import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft } from 'lucide-react';
import { listFaces } from '../../shared/face-registry';
import { FaceGalleryCard } from '../components/FaceGalleryCard';
import { PushOutcomeChip } from '../components/PushOutcomeChip';
import { adminApi } from '../lib/api';
import { useDeviceId, useDeviceStatus, deviceDisplayName } from '../lib/device-scope';
import { buildCapabilities } from '../../shared/capabilities';
import { cn } from '../lib/cn';
import type { FaceDescriptor, PushOutcome } from '../../shared/types';

// Face Gallery (wf/10-face-gallery). Route is /clock/:deviceId/apps/clock/
// gallery — clock-only by design, so the created instance's appId is pinned
// rather than read from params. Tap adds with defaults, then Screen Config
// opens for fine-tuning (FaceConfig is subsumed by Screen Config).

function CategoryChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'rounded-full border border-[hsl(var(--border))] px-3 py-1 text-sm capitalize transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]',
        active
          ? 'border-transparent bg-[hsl(var(--foreground))] font-medium text-[hsl(var(--background))]'
          : 'opacity-80 hover:bg-[hsl(var(--muted))]',
      )}
    >
      {label}
    </button>
  );
}

export default function FaceGallery() {
  const deviceId = useDeviceId();
  const status = useDeviceStatus(deviceId);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [category, setCategory] = useState<string | null>(null);
  const [lastOutcome, setLastOutcome] = useState<PushOutcome | null>(null);

  const faces = listFaces();
  const categories = Array.from(
    new Set(faces.map((f) => f.category).filter((c): c is string => c !== undefined)),
  );
  const shown = category ? faces.filter((f) => f.category === category) : faces;

  const readOnly = buildCapabilities(deviceId).readOnly;
  const offline = status.known && !status.reachable;

  const createInstance = useMutation({
    mutationFn: (face: FaceDescriptor) =>
      adminApi.createInstance(deviceId, {
        appId: 'clock',
        config: { faceId: face.id, face: {}, complications: {} },
        label: face.name,
      }),
    onSuccess: async (result) => {
      setLastOutcome(result.pushOutcome);
      await queryClient.invalidateQueries({ queryKey: ['device', deviceId] });
      navigate(`/clock/${deviceId}/screens/${result.instance.id}`);
    },
  });

  return (
    <div className="space-y-4">
      <header className="flex items-center gap-2">
        <Link
          to={`/clock/${deviceId}/apps/clock`}
          aria-label="Back to Clock"
          className="rounded-md p-1 hover:bg-[hsl(var(--muted))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]"
        >
          <ChevronLeft className="h-5 w-5" aria-hidden />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-bold tracking-tight">
            Add face to {deviceDisplayName(deviceId)}
          </h1>
          <p className="text-xs text-[hsl(var(--muted-foreground))]">
            Tap a face to add it with defaults, then fine-tune in its config.
          </p>
        </div>
        <PushOutcomeChip outcome={lastOutcome} />
      </header>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter faces by category">
        <CategoryChip label="all" active={category === null} onClick={() => setCategory(null)} />
        {categories.map((c) => (
          <CategoryChip key={c} label={c} active={category === c} onClick={() => setCategory(c)} />
        ))}
      </div>

      {readOnly && (
        <p className="text-sm opacity-60">
          This clock is read-only — faces can&apos;t be added from the admin.
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {shown.map((face) => (
          <FaceGalleryCard
            key={face.id}
            face={face}
            onPick={(f) => createInstance.mutate(f)}
            disabled={offline || readOnly || createInstance.isPending}
          />
        ))}
      </div>

      {createInstance.isPending && <p className="text-sm opacity-60">Adding face…</p>}
      {createInstance.isError && (
        <p className="text-sm text-[hsl(var(--destructive))]">
          Couldn&apos;t add the face — {(createInstance.error as Error).message}
        </p>
      )}
    </div>
  );
}
