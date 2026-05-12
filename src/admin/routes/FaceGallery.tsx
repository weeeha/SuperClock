import { useNavigate, useParams, Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft } from 'lucide-react';
import { listFaces } from '../../shared/face-registry';
import { FaceGalleryCard } from '../components/FaceGalleryCard';
import { adminApi } from '../lib/api';
import { useActiveDevice } from '../store/active-device';
import type { FaceDescriptor } from '../../shared/types';

export default function FaceGallery() {
  const { appId = '' } = useParams();
  const { activeDeviceId } = useActiveDevice();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const faces = listFaces();

  const createInstance = useMutation({
    mutationFn: (face: FaceDescriptor) =>
      adminApi.createInstance(activeDeviceId, {
        appId,
        config: { faceId: face.id, face: {}, complications: {} },
        label: face.name,
      }),
    onSuccess: async (instance) => {
      await queryClient.invalidateQueries({ queryKey: ['device', activeDeviceId] });
      navigate(`/apps/${appId}/faces/${instance.id}`);
    },
  });

  return (
    <div className="space-y-6 p-6 pb-24">
      <header className="flex items-center gap-3">
        <Link
          to={`/apps/${appId}`}
          className="rounded-md p-1 hover:bg-[hsl(var(--muted))]"
          aria-label="Back"
        >
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight">Face Gallery</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            Tap a face to add it to {activeDeviceId}.
          </p>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {faces.map((face) => (
          <FaceGalleryCard
            key={face.id}
            face={face}
            onPick={(f) => createInstance.mutate(f)}
          />
        ))}
      </div>

      {createInstance.isPending && (
        <p className="text-sm opacity-60">Adding face…</p>
      )}
    </div>
  );
}
