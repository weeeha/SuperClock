import { useEffect, useMemo, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, Plus, RotateCcw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { FaceCard } from '../components/FaceCard';
import { SchemaForm } from '../lib/schema-form';
import { adminApi } from '../lib/api';
import { useActiveDevice } from '../store/active-device';
import { getSchema, defaultsFor } from '../../shared/schema-registry';
import type { ScreenInstance } from '../../shared/types';

function APP_TITLES(appId: string): string {
  const map: Record<string, string> = {
    'photo-frame': 'Photos',
    'time-tracking': 'Timer',
    'claude-usage': 'Claude Usage',
  };
  return map[appId] ?? appId.charAt(0).toUpperCase() + appId.slice(1);
}

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

  if (appId === 'clock') {
    return (
      <div className="space-y-6 p-6 pb-24">
        <Header appId={appId} />
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>My Faces ({instances.length})</CardTitle>
              <Button size="sm" onClick={() => navigate(`/apps/${appId}/gallery`)}>
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
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 pb-32">
      <Header appId={appId} />
      <AppSettingsCard
        appId={appId}
        instance={instances[0]}
      />
    </div>
  );
}

function Header({ appId }: { appId: string }) {
  return (
    <header className="flex items-center gap-3">
      <Link
        to="/apps"
        className="rounded-md p-1 hover:bg-[hsl(var(--muted))]"
        aria-label="Back"
      >
        <ChevronLeft className="h-5 w-5" />
      </Link>
      <div className="flex-1">
        <h1 className="text-3xl font-bold tracking-tight">{APP_TITLES(appId)}</h1>
      </div>
    </header>
  );
}

function AppSettingsCard({
  appId,
  instance,
}: {
  appId: string;
  instance: ScreenInstance | undefined;
}) {
  const { activeDeviceId } = useActiveDevice();
  const queryClient = useQueryClient();

  const schemaId = `app.${appId}`;
  const entry = useMemo(() => getSchema(schemaId), [schemaId]);
  const defaults = useMemo(() => defaultsFor(schemaId), [schemaId]);

  // Working config seeded from existing instance (if any) merged onto defaults
  // so brand-new fields added to a schema later appear with their default.
  const initial = useMemo(
    () => ({ ...defaults, ...(instance?.config ?? {}) }),
    [defaults, instance?.config],
  );
  const [working, setWorking] = useState<Record<string, unknown>>(initial);

  useEffect(() => {
    setWorking(initial);
  }, [initial]);

  const save = useMutation({
    mutationFn: async () => {
      if (instance) {
        return adminApi.patchInstance(activeDeviceId, instance.id, { config: working });
      }
      return adminApi.createInstance(activeDeviceId, { appId, config: working });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['device', activeDeviceId] });
    },
  });

  const reset = () => setWorking(defaults);

  const dirty = JSON.stringify(working) !== JSON.stringify(initial);

  if (!entry) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>App settings</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm opacity-60">
            No configurable options for {appId} yet — this app ships with a fixed config.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>App settings</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={reset}
              disabled={JSON.stringify(working) === JSON.stringify(defaults)}
              aria-label="Reset to defaults"
            >
              <RotateCcw className="h-4 w-4" /> Reset
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <SchemaForm
            schema={entry.schema}
            meta={entry.meta}
            value={working}
            onChange={setWorking}
          />
        </CardContent>
      </Card>

      <div className="fixed bottom-20 left-1/2 z-20 -translate-x-1/2">
        <Button onClick={() => save.mutate()} disabled={!dirty || save.isPending}>
          {save.isPending ? 'Saving…' : dirty ? 'Save changes' : 'Saved'}
        </Button>
      </div>
    </>
  );
}
