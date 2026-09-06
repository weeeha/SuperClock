import { useEffect, useMemo, useState } from 'react';
import { useParams, Link, Navigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, Plus, RotateCcw } from 'lucide-react';
import { Button } from '../components/ui/button';
import { FaceCard } from '../components/FaceCard';
import { PushOutcomeChip } from '../components/PushOutcomeChip';
import { SchemaForm } from '../lib/schema-form';
import { adminApi } from '../lib/api';
import { useDeviceId, useDeviceStatus, deviceDisplayName } from '../lib/device-scope';
import { appDisplayName } from '../lib/app-names';
import { buildCapabilities } from '../../shared/capabilities';
import { getSchema, defaultsFor } from '../../shared/schema-registry';
import { cn } from '../lib/cn';
import type { DeviceId, PushOutcome, ScreenInstance } from '../../shared/types';

// App Detail (wf/6-app-detail): one app on one clock. Clock lists face
// instances (screens) linking to Screen Config; other apps edit their
// app-level schema here. Face deletion moved to Screen Config's danger row.

export default function AppDetail() {
  const { appId = '' } = useParams();
  const deviceId = useDeviceId();
  const status = useDeviceStatus(deviceId);

  const deviceQ = useQuery({
    queryKey: ['device', deviceId],
    queryFn: () => adminApi.getDevice(deviceId),
  });

  const caps = buildCapabilities(deviceId);
  if (!caps.apps.some((a) => a.id === appId)) {
    return <Navigate to={`/clock/${deviceId}/apps`} replace />;
  }

  const offline = status.known && !status.reachable;
  const cfg = deviceQ.data;
  const instances = (cfg?.instances ?? []).filter((i) => i.appId === appId);
  // Empty stored list = all apps enabled (kiosk semantics).
  const isOn = cfg ? cfg.enabledApps.length === 0 || cfg.enabledApps.includes(appId) : null;

  if (!deviceQ.isPending && !cfg) {
    return (
      <div className="space-y-4">
        <DetailHeader deviceId={deviceId} appId={appId} on={null} />
        <div className="rounded-lg border border-[hsl(var(--border))] p-4">
          <p className="text-sm opacity-70">Couldn&apos;t load this clock&apos;s config.</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => deviceQ.refetch()}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  if (appId === 'clock') {
    const playlistSet = new Set(cfg?.playlist.items ?? []);
    return (
      <div className="space-y-4">
        <DetailHeader deviceId={deviceId} appId={appId} on={isOn} />

        <section>
          <h2 className="text-xs font-medium uppercase tracking-wide opacity-60">
            My faces · {instances.length}
          </h2>
          <div className="mt-2 space-y-2">
            {deviceQ.isPending && (
              <div aria-busy="true" className="space-y-2">
                <p className="sr-only">Loading faces</p>
                {[0, 1].map((i) => (
                  <div
                    key={i}
                    className="h-16 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))]"
                  />
                ))}
              </div>
            )}
            {!deviceQ.isPending && instances.length === 0 && (
              <p className="text-sm opacity-60">No faces yet — add one from the gallery.</p>
            )}
            {instances.map((instance) => (
              <FaceCard
                key={instance.id}
                instance={instance}
                to={`/clock/${deviceId}/screens/${instance.id}`}
                inPlaylist={playlistSet.has(instance.id)}
              />
            ))}
          </div>
        </section>

        {!caps.readOnly && (
          <Link
            to={`/clock/${deviceId}/apps/clock/gallery`}
            className="flex items-center justify-center gap-2 rounded-lg border border-[hsl(var(--border))] p-3 text-sm font-medium transition-colors hover:bg-[hsl(var(--muted))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]"
          >
            <Plus className="h-4 w-4" aria-hidden />
            Add face — browse gallery
          </Link>
        )}

        <aside className="rounded-lg bg-[hsl(var(--muted))] p-3 text-xs">
          <p className="font-medium">Faces are screens</p>
          <p className="mt-1 opacity-70">
            Each face instance is playlist-eligible on its own, equal to a Habits or Weather
            screen. Deleting the instance removes it from the playlist too.
          </p>
        </aside>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <DetailHeader deviceId={deviceId} appId={appId} on={isOn} />
      <AppSettingsSection appId={appId} instance={instances[0]} writesDisabled={offline} />
    </div>
  );
}

function DetailHeader({
  deviceId,
  appId,
  on,
}: {
  deviceId: DeviceId;
  appId: string;
  on: boolean | null;
}) {
  return (
    <header className="flex items-center gap-2">
      <Link
        to={`/clock/${deviceId}/apps`}
        aria-label="Back to apps"
        className="rounded-md p-1 hover:bg-[hsl(var(--muted))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]"
      >
        <ChevronLeft className="h-5 w-5" aria-hidden />
      </Link>
      <h1 className="min-w-0 flex-1 truncate text-xl font-bold tracking-tight">
        {appDisplayName(appId)} on {deviceDisplayName(deviceId)}
      </h1>
      {on !== null && (
        <span
          className={cn(
            'rounded-full px-2.5 py-0.5 text-xs font-medium',
            on
              ? 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]'
              : 'bg-[hsl(var(--muted))] opacity-80',
          )}
        >
          {on ? 'on' : 'off'}
        </span>
      )}
    </header>
  );
}

function AppSettingsSection({
  appId,
  instance,
  writesDisabled,
}: {
  appId: string;
  instance: ScreenInstance | undefined;
  writesDisabled: boolean;
}) {
  const deviceId = useDeviceId();
  const queryClient = useQueryClient();
  const [lastOutcome, setLastOutcome] = useState<PushOutcome | null>(null);

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
        return adminApi.patchInstance(deviceId, instance.id, { config: working });
      }
      return adminApi.createInstance(deviceId, { appId, config: working });
    },
    onSuccess: async (result) => {
      setLastOutcome(result.pushOutcome);
      await queryClient.invalidateQueries({ queryKey: ['device', deviceId] });
    },
  });

  const reset = () => setWorking(defaults);

  const dirty = JSON.stringify(working) !== JSON.stringify(initial);

  if (!entry) {
    return (
      <section>
        <h2 className="text-xs font-medium uppercase tracking-wide opacity-60">App settings</h2>
        <p className="mt-2 text-sm opacity-60">
          No configurable options for {appDisplayName(appId)} yet — this app ships with a fixed
          config.
        </p>
      </section>
    );
  }

  return (
    <section>
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-medium uppercase tracking-wide opacity-60">App settings</h2>
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
      <div className="mt-2 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
        <SchemaForm schema={entry.schema} meta={entry.meta} value={working} onChange={setWorking} />
        <div className="mt-4 flex items-center justify-end gap-2">
          <PushOutcomeChip outcome={lastOutcome} />
          <Button
            onClick={() => save.mutate()}
            disabled={!dirty || save.isPending || writesDisabled}
          >
            {save.isPending ? 'Saving…' : dirty ? 'Save changes' : 'Saved'}
          </Button>
        </div>
        {save.isError && (
          <p className="mt-2 text-right text-sm text-[hsl(var(--destructive))]">
            Couldn&apos;t save — {(save.error as Error).message}
          </p>
        )}
      </div>
    </section>
  );
}
