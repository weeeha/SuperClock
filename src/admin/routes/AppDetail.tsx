import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, Plus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { FaceCard } from '../components/FaceCard';
import { adminApi } from '../lib/api';
import { useActiveDevice } from '../store/active-device';

export default function AppDetail() {
  const { appId = '' } = useParams();
  const { activeDeviceId } = useActiveDevice();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const deviceQ = useQuery({
    queryKey: ['device', activeDeviceId],
    queryFn: () => adminApi.getDevice(activeDeviceId),
  });

  const deleteInstance = useMutation({
    mutationFn: (id: string) => adminApi.deleteInstance(activeDeviceId, id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['device', activeDeviceId] });
    },
  });

  const instances = (deviceQ.data?.instances ?? []).filter((i) => i.appId === appId);

  return (
    <div className="space-y-6 p-6 pb-24">
      <header className="flex items-center gap-3">
        <Link
          to="/apps"
          className="rounded-md p-1 hover:bg-[hsl(var(--muted))]"
          aria-label="Back"
        >
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight capitalize">{appId}</h1>
        </div>
      </header>

      {appId === 'clock' ? (
        <>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>My Faces ({instances.length})</CardTitle>
                <Button
                  size="sm"
                  onClick={() => navigate(`/apps/${appId}/gallery`)}
                >
                  <Plus className="h-4 w-4" /> Add Face
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {instances.length === 0 && (
                <p className="text-sm opacity-60">
                  No faces yet. Tap "Add Face" to pick one from the gallery.
                </p>
              )}
              {instances.map((instance) => (
                <FaceCard
                  key={instance.id}
                  instance={instance}
                  appId={appId}
                  onDelete={(id) => deleteInstance.mutate(id)}
                />
              ))}
            </CardContent>
          </Card>
        </>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>App settings</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm opacity-60">
              No configurable options for {appId} yet — this app ships with a fixed config in v1.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
