import { useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { SlotGrid } from '../components/SlotGrid';
import { adminApi } from '../lib/api';
import { useActiveDevice } from '../store/active-device';
import { getFace } from '../../shared/face-registry';

type FaceConfigShape = {
  faceId?: string;
  face?: Record<string, unknown>;
  complications?: Record<string, { id: string } | undefined>;
};

export default function FaceConfig() {
  const { appId = '', instanceId = '' } = useParams();
  const { activeDeviceId } = useActiveDevice();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const deviceQ = useQuery({
    queryKey: ['device', activeDeviceId],
    queryFn: () => adminApi.getDevice(activeDeviceId),
  });

  const instance = deviceQ.data?.instances.find((i) => i.id === instanceId);
  const initialConfig = (instance?.config ?? {}) as FaceConfigShape;
  const faceId = initialConfig.faceId;
  const face = faceId ? getFace(faceId) : undefined;

  const [working, setWorking] = useState<FaceConfigShape>(initialConfig);
  // Re-seed the editable copy when the underlying instance changes (query
  // resolves, refetches after a save, or a different instance is opened).
  // "Adjust state during render" — replaces a setState-in-Effect.
  const [syncedInstance, setSyncedInstance] = useState(instance);
  if (instance && instance !== syncedInstance) {
    setSyncedInstance(instance);
    setWorking((instance.config ?? {}) as FaceConfigShape);
  }

  const save = useMutation({
    mutationFn: () =>
      adminApi.patchInstance(activeDeviceId, instanceId, { config: working as Record<string, unknown> }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['device', activeDeviceId] });
    },
  });

  const remove = useMutation({
    mutationFn: () => adminApi.deleteInstance(activeDeviceId, instanceId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['device', activeDeviceId] });
      navigate(`/apps/${appId}`);
    },
  });

  if (deviceQ.isLoading) {
    return <p className="p-6 text-sm opacity-60">Loading…</p>;
  }
  if (!instance) {
    return (
      <div className="space-y-4 p-6">
        <p className="text-sm">Instance not found.</p>
        <Link to={`/apps/${appId}`} className="text-sm underline">
          Back
        </Link>
      </div>
    );
  }

  const dirty = JSON.stringify(working) !== JSON.stringify(initialConfig);
  const complications = working.complications ?? {};

  return (
    <div className="space-y-6 p-6 pb-32">
      <header className="flex items-center gap-3">
        <Link
          to={`/apps/${appId}`}
          className="rounded-md p-1 hover:bg-[hsl(var(--muted))]"
          aria-label="Back"
        >
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">{face?.name ?? faceId ?? 'Face'}</h1>
          <p className="text-xs text-[hsl(var(--muted-foreground))]">
            Instance <code className="font-mono">{instanceId.slice(0, 8)}</code>
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => remove.mutate()}
          disabled={remove.isPending}
          aria-label="Delete face"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </header>

      {face?.preview && (
        <div className="flex justify-center">
          <img
            src={face.preview}
            alt=""
            className="h-40 w-40 rounded-2xl object-cover"
          />
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Complications</CardTitle>
        </CardHeader>
        <CardContent>
          <SlotGrid
            slots={face?.slots ?? []}
            values={complications}
            onChange={(next) => setWorking({ ...working, complications: next })}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Face options</CardTitle>
        </CardHeader>
        <CardContent>
          {face?.configSchemaId ? (
            <p className="text-sm opacity-60">
              Schema-driven form coming with the retrofit of this face.
            </p>
          ) : (
            <p className="text-sm opacity-60">
              This face has no configurable options.
            </p>
          )}
        </CardContent>
      </Card>

      <div className="fixed bottom-20 left-1/2 z-20 -translate-x-1/2">
        <Button
          onClick={() => save.mutate()}
          disabled={!dirty || save.isPending}
        >
          {save.isPending ? 'Saving…' : dirty ? 'Save changes' : 'Saved'}
        </Button>
      </div>
    </div>
  );
}
