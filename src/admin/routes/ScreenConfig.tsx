import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Dialog } from '../components/ui/dialog';
import { PushOutcomeChip } from '../components/PushOutcomeChip';
import { SchemaForm } from '../lib/schema-form';
import { adminApi } from '../lib/api';
import { deviceDisplayName, useDeviceId, useDeviceStatus } from '../lib/device-scope';
import { artForInstance } from '../lib/screen-art';
import { cn } from '../lib/cn';
import { defaultsFor, getSchema } from '../../shared/schema-registry';
import { STATIC_DEVICE_INFO } from '../../shared/capabilities';
import type { PushOutcome, ScreenInstance } from '../../shared/types';

// Screen Config — template v1 (wf/4-screen-config). Zones top→bottom: header
// (back → playlist tab, "«label» on «Clock»", saved-state), static preview,
// name row, SchemaForm over the instance schema, danger row. The Schedule and
// Activity zones from the wireframe are P3/P2 — deliberately not rendered.

export default function ScreenConfig() {
  const deviceId = useDeviceId();
  const { instanceId } = useParams();
  const deviceQ = useQuery({
    queryKey: ['device', deviceId],
    queryFn: () => adminApi.getDevice(deviceId),
  });

  if (deviceQ.isPending) {
    // Static skeleton matching the template zones (admin chrome never animates).
    return (
      <div aria-busy="true" className="space-y-6">
        <div className="h-6 w-2/3 rounded-md bg-[hsl(var(--muted))]" />
        <div className="mx-auto h-44 w-44 rounded-full bg-[hsl(var(--muted))]" />
        <div className="h-14 rounded-lg bg-[hsl(var(--muted))]" />
        <div className="h-40 rounded-lg bg-[hsl(var(--muted))]" />
      </div>
    );
  }

  if (!deviceQ.data) {
    return (
      <div className="space-y-3">
        <p className="text-sm opacity-80">Couldn’t load this clock’s config.</p>
        <Button variant="outline" size="sm" onClick={() => void deviceQ.refetch()}>
          Retry
        </Button>
      </div>
    );
  }

  const instance = deviceQ.data.instances.find((i) => i.id === instanceId);
  if (!instance) return <Navigate to=".." replace />;

  return <ScreenConfigBody instance={instance} />;
}

function ScreenConfigBody({ instance }: { instance: ScreenInstance }) {
  const deviceId = useDeviceId();
  const clockName = deviceDisplayName(deviceId);
  const status = useDeviceStatus(deviceId);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const offline = status.known && !status.reachable;
  // Unreachable ≠ locked: writes persist and queue (chip + shell banner tell
  // the truth about delivery). Offline only dims the preview.
  const locked = STATIC_DEVICE_INFO[deviceId].readOnly;

  const art = artForInstance(instance);
  // Display name the kiosk falls back to when no custom label is set.
  const fallbackName = artForInstance({ ...instance, label: undefined }).label;

  // Schema resolution: clock instances edit the `face` sub-object against
  // `face.<faceId>`; every other app edits its whole config against
  // `app.<appId>`. Saving a clock instance spreads the stored config so
  // faceId and complications survive untouched.
  const isClock = instance.appId === 'clock';
  const faceId = typeof instance.config.faceId === 'string' ? instance.config.faceId : undefined;
  const schemaId = isClock ? (faceId ? `face.${faceId}` : undefined) : `app.${instance.appId}`;
  const entry = getSchema(schemaId);
  const defaults = useMemo(() => defaultsFor(schemaId), [schemaId]);
  const savedOptions = useMemo<Record<string, unknown>>(() => {
    const raw = isClock ? instance.config.face : instance.config;
    return raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  }, [isClock, instance.config]);

  // Working copy + explicit save (same protocol as AppDetail), but re-seeded
  // by CONTENT, not object identity — an unrelated write (renaming) refetches
  // the device query and must not stomp in-progress option edits.
  const initial = useMemo(() => ({ ...defaults, ...savedOptions }), [defaults, savedOptions]);
  const initialKey = JSON.stringify(initial);
  const [working, setWorking] = useState<Record<string, unknown>>(initial);
  useEffect(() => {
    setWorking((w) =>
      JSON.stringify(w) === initialKey ? w : (JSON.parse(initialKey) as Record<string, unknown>),
    );
  }, [initialKey]);
  const dirty = JSON.stringify(working) !== initialKey;

  // Creation surfaces (Add Screen sheet, Face Gallery) navigate here with the
  // create's pushOutcome in location state — surface it on arrival so the
  // outcome of "add" isn't silently dropped by the navigation.
  const location = useLocation();
  const arrivalOutcome =
    (location.state as { pushOutcome?: PushOutcome } | null)?.pushOutcome ?? null;
  const [configOutcome, setConfigOutcome] = useState<PushOutcome | null>(arrivalOutcome);
  const saveConfig = useMutation({
    mutationFn: () =>
      adminApi.patchInstance(deviceId, instance.id, {
        config: isClock ? { ...instance.config, face: working } : working,
      }),
    onSuccess: async (res) => {
      setConfigOutcome(res.pushOutcome);
      await queryClient.invalidateQueries({ queryKey: ['device', deviceId] });
    },
  });

  // Name row — commits on blur / submit; empty input reverts to the saved
  // label (unnamed screens keep the face/app name, shown as placeholder).
  const savedLabel = instance.label ?? '';
  const [name, setName] = useState(savedLabel);
  useEffect(() => {
    setName(savedLabel);
  }, [savedLabel]);
  const [nameOutcome, setNameOutcome] = useState<PushOutcome | null>(null);
  const saveName = useMutation({
    mutationFn: (label: string) => adminApi.patchInstance(deviceId, instance.id, { label }),
    onSuccess: async (res) => {
      setNameOutcome(res.pushOutcome);
      await queryClient.invalidateQueries({ queryKey: ['device', deviceId] });
    },
  });
  const submitName = () => {
    const trimmed = name.trim();
    if (trimmed === '') {
      setName(savedLabel);
      return;
    }
    if (trimmed === savedLabel || saveName.isPending) return;
    saveName.mutate(trimmed);
  };

  const [confirmOpen, setConfirmOpen] = useState(false);
  const remove = useMutation({
    mutationFn: () => adminApi.deleteInstance(deviceId, instance.id),
    onSuccess: () => {
      // Server drops the playlist entry in the same write (admin-routes DELETE).
      void queryClient.invalidateQueries({ queryKey: ['device', deviceId] });
      void navigate('..');
    },
  });

  const savedState =
    saveConfig.isPending || saveName.isPending ? 'saving…' : dirty ? 'unsaved changes' : 'saved';

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-2">
        <Link
          to=".."
          aria-label="Back to playlist"
          className="-ml-1 rounded-md p-1 hover:bg-[hsl(var(--muted))]"
        >
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <h1 className="min-w-0 flex-1 truncate text-lg font-semibold">
          {art.label} on {clockName}
        </h1>
        <span className="shrink-0 text-xs opacity-60">{savedState}</span>
      </header>

      {/* Static preview (P1: registry art; live component arrives in P2 into this slot). */}
      <div className="flex justify-center">
        <div
          className={cn(
            'flex h-44 w-44 items-center justify-center overflow-hidden border border-[hsl(var(--border))] bg-[hsl(var(--muted))]',
            deviceId === 'superclock-square' ? 'rounded-3xl' : 'rounded-full',
            offline && 'opacity-50',
          )}
        >
          {art.src &&
            (isClock ? (
              <img src={art.src} alt="" className="h-full w-full object-cover" />
            ) : (
              <img src={art.src} alt="" className="h-16 w-16 object-contain" />
            ))}
        </div>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submitName();
        }}
        className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2 focus-within:ring-2 focus-within:ring-[hsl(var(--ring))]"
      >
        <label htmlFor="screen-name" className="text-xs opacity-60">
          Name
        </label>
        <div className="flex items-center gap-2">
          <input
            id="screen-name"
            type="text"
            value={name}
            placeholder={fallbackName}
            disabled={locked}
            onChange={(e) => setName(e.target.value)}
            onBlur={submitName}
            className="w-full bg-transparent py-0.5 text-sm focus:outline-none disabled:opacity-50"
          />
          <PushOutcomeChip outcome={nameOutcome} />
        </div>
      </form>

      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wide opacity-60">
          {isClock ? 'Face options' : 'App options'}
        </h2>
        {entry ? (
          <>
            <Card className="mt-2">
              <CardContent className="p-4">
                <fieldset disabled={locked} className={cn(locked && 'opacity-60')}>
                  <SchemaForm
                    schema={entry.schema}
                    meta={entry.meta}
                    value={working}
                    onChange={setWorking}
                  />
                </fieldset>
              </CardContent>
            </Card>
            <div className="mt-3 flex items-center justify-end gap-2">
              <PushOutcomeChip outcome={configOutcome} />
              <Button
                onClick={() => saveConfig.mutate()}
                disabled={locked || !dirty || saveConfig.isPending}
              >
                {saveConfig.isPending ? 'Saving…' : dirty ? 'Save changes' : 'Saved'}
              </Button>
            </div>
          </>
        ) : (
          <p className="mt-2 text-sm opacity-60">
            No configurable options — this screen ships with a fixed config.
          </p>
        )}
      </section>

      <div className="pt-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setConfirmOpen(true)}
          disabled={locked}
          className="px-1 text-[hsl(var(--destructive))]"
        >
          Remove from {clockName}
        </Button>
      </div>

      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)} title="Remove screen?">
        <p className="break-words text-sm opacity-80">
          Removes “{art.label}” from {clockName} and its playlist. Its settings are not kept.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setConfirmOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => remove.mutate()}
            disabled={remove.isPending}
          >
            {remove.isPending ? 'Removing…' : 'Remove screen'}
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
