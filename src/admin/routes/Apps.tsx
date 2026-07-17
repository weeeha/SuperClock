import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Switch } from '../components/ui/switch';
import { adminApi } from '../lib/api';
import { useActiveDevice } from '../store/active-device';
import type { DeviceId } from '../../shared/types';

const APP_LABELS: Record<string, string> = {
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

export default function Apps() {
  const { activeDeviceId } = useActiveDevice();
  const queryClient = useQueryClient();

  const capsQ = useQuery({ queryKey: ['caps'], queryFn: adminApi.getOwnCapabilities });
  const deviceQ = useQuery({
    queryKey: ['device', activeDeviceId],
    queryFn: () => adminApi.getDevice(activeDeviceId),
  });

  const toggle = useMutation({
    mutationFn: async ({ deviceId, appId, enabled }: { deviceId: DeviceId; appId: string; enabled: boolean }) => {
      // Kiosk semantics: an EMPTY enabledApps means "all apps enabled"
      // (fresh-device default). Turning one app off from that state must
      // therefore materialize the full list first, or the write is a no-op.
      const stored = deviceQ.data?.enabledApps ?? [];
      const current = stored.length > 0 ? stored : (capsQ.data?.apps ?? []).map((a) => a.id);
      const next = enabled
        ? Array.from(new Set([...current, appId]))
        : current.filter((id) => id !== appId);
      return adminApi.patchDevice(deviceId, { enabledApps: next });
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(['device', activeDeviceId], updated);
    },
  });

  const apps = capsQ.data?.apps ?? [];
  // Empty list = all enabled (mirror the kiosk's interpretation).
  const storedEnabled = deviceQ.data?.enabledApps ?? [];
  const enabled = new Set(storedEnabled.length > 0 ? storedEnabled : apps.map((a) => a.id));
  const instancesByApp = new Map<string, number>();
  for (const inst of deviceQ.data?.instances ?? []) {
    instancesByApp.set(inst.appId, (instancesByApp.get(inst.appId) ?? 0) + 1);
  }

  return (
    <div className="space-y-6 p-6 pb-24">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Apps</h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          Enable apps for <span className="font-medium">{activeDeviceId}</span>. Tap a row to configure.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Catalog</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          {capsQ.isLoading && <p className="text-sm opacity-60">Loading…</p>}
          {!capsQ.isLoading &&
            apps.map((app) => {
              const isOn = enabled.has(app.id);
              const instanceCount = instancesByApp.get(app.id) ?? 0;
              return (
                <div
                  key={app.id}
                  className="flex items-center gap-2 rounded-md hover:bg-[hsl(var(--muted))]"
                >
                  <Link
                    to={`/apps/${app.id}`}
                    className="flex flex-1 items-center justify-between px-3 py-2"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium">{APP_LABELS[app.id] ?? app.id}</span>
                      {app.id === 'clock' && app.faces && (
                        <span className="text-xs opacity-60">{app.faces.length} faces</span>
                      )}
                      {instanceCount > 0 && (
                        <span className="rounded-full bg-[hsl(var(--primary))] px-1.5 py-0.5 text-[10px] font-medium text-[hsl(var(--primary-foreground))]">
                          {instanceCount}
                        </span>
                      )}
                    </div>
                    <ChevronRight className="h-4 w-4 opacity-40" />
                  </Link>
                  <div className="pr-3">
                    <Switch
                      checked={isOn}
                      onCheckedChange={(next) =>
                        toggle.mutate({ deviceId: activeDeviceId, appId: app.id, enabled: next })
                      }
                      disabled={toggle.isPending}
                    />
                  </div>
                </div>
              );
            })}
          {toggle.isError && (
            <p className="text-sm text-[hsl(var(--destructive))]">
              {(toggle.error as Error).message}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
