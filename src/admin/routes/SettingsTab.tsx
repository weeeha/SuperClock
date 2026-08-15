import { useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Switch } from '../components/ui/switch';
import { PushOutcomeChip } from '../components/PushOutcomeChip';
import { adminApi } from '../lib/api';
import { useDeviceId, useDeviceStatus, deviceDisplayName } from '../lib/device-scope';
import { STATIC_DEVICE_INFO } from '../../shared/capabilities';
import { DEFAULT_ACCENT } from '../../shared/types';
import type { DeviceConfig, FeatureFlag } from '../../shared/types';

// Settings tab (wf/7): grouped rows with current values in subtitles.
// Identity / Display / Night & Sleep — rows edit inline, one save mutation
// writes the whole `settings` object (same contract as the pre-IA-v2
// Settings.tsx). Feature-gated rows render disabled with a note, never
// hidden. P2 items (maintenance, restart, identify, mirror) do not render.

type SettingsShape = DeviceConfig['settings'];

const DEFAULTS: SettingsShape = {
  theme: 'system',
  accent: DEFAULT_ACCENT,
  // 100 = no dimming. Must stay neutral: the form saves the whole settings
  // object, so a non-neutral default would get baked in by unrelated saves.
  brightness: 100,
  sleepSchedule: undefined,
  night: undefined,
};

const timeInputClass =
  'rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-2 py-1 disabled:cursor-not-allowed disabled:opacity-50';

function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="px-1 text-xs font-medium uppercase tracking-wide opacity-60">{label}</h2>
      <Card className="divide-y divide-[hsl(var(--border))]">{children}</Card>
    </section>
  );
}

function Row({
  title,
  subtitle,
  right,
  children,
}: {
  title: string;
  subtitle?: ReactNode;
  right?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="space-y-2 px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-medium">{title}</div>
          {subtitle != null && <div className="break-words text-xs opacity-60">{subtitle}</div>}
        </div>
        {right}
      </div>
      {children}
    </div>
  );
}

/** Static placeholder matching the group anatomy — no animation (admin chrome
 *  animates only on state change). */
function SkeletonGroups() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading settings">
      {['Identity', 'Display', 'Night & Sleep'].map((label) => (
        <Group key={label} label={label}>
          {[0, 1].map((i) => (
            <div key={i} className="space-y-2 px-4 py-3">
              <div className="h-3 w-24 rounded bg-[hsl(var(--muted))]" />
              <div className="h-2.5 w-40 rounded bg-[hsl(var(--muted))]" />
            </div>
          ))}
        </Group>
      ))}
    </div>
  );
}

export default function SettingsTab() {
  const deviceId = useDeviceId();
  const status = useDeviceStatus(deviceId);
  const queryClient = useQueryClient();
  const info = STATIC_DEVICE_INFO[deviceId];

  const deviceQ = useQuery({
    queryKey: ['device', deviceId],
    queryFn: () => adminApi.getDevice(deviceId),
  });

  // /api/health is origin-relative, so in P1 this is the ADMIN host's own
  // build — labeled "Admin build" below, never presented as the clock's.
  const stampQ = useQuery({
    queryKey: ['health-stamp'],
    queryFn: adminApi.getHealthStamp,
    staleTime: 60_000,
  });

  const initial: SettingsShape = { ...DEFAULTS, ...(deviceQ.data?.settings ?? {}) };
  const [working, setWorking] = useState<SettingsShape>(initial);
  // Re-seed the editable copy when the device query (re)resolves — e.g. after
  // a save invalidates and refetches. "Adjust state during render" pattern,
  // replacing a setState-in-Effect.
  const [syncedData, setSyncedData] = useState(deviceQ.data);
  if (deviceQ.data && deviceQ.data !== syncedData) {
    setSyncedData(deviceQ.data);
    setWorking({ ...DEFAULTS, ...deviceQ.data.settings });
  }

  const save = useMutation({
    mutationFn: () => adminApi.patchDevice(deviceId, { settings: working }),
    onSuccess: (result) => queryClient.setQueryData(['device', deviceId], result.config),
  });

  if (deviceQ.isPending) return <SkeletonGroups />;
  if (!deviceQ.data) {
    return (
      <div className="p-2 text-sm">
        <p className="opacity-70">couldn't load settings for {deviceDisplayName(deviceId)}</p>
        <Button variant="outline" size="sm" className="mt-2" onClick={() => deviceQ.refetch()}>
          Retry
        </Button>
      </div>
    );
  }

  const offline = status.known && !status.reachable;
  const writable = !info.readOnly && !offline;
  const has = (flag: FeatureFlag) => info.features.includes(flag);
  const canEdit = (flag: FeatureFlag) => has(flag) && writable;
  // Feature-gated rows stay visible; the note explains the disabled controls.
  const gateNote = (flag: FeatureFlag, value: ReactNode) =>
    has(flag) ? value : 'not available on this clock';

  const dirty = JSON.stringify(working) !== JSON.stringify(initial);
  const sleepEnabled = Boolean(working.sleepSchedule);
  const nightEnabled = Boolean(working.night);

  const commit = stampQ.data?.build?.commit;
  const builtAt = stampQ.data?.build?.builtAt;
  const buildStamp = commit
    ? `${commit.slice(0, 7)}${builtAt ? ` · ${new Date(builtAt).toLocaleDateString()}` : ''}`
    : stampQ.isPending
      ? '…'
      : 'unavailable';

  return (
    <div className="space-y-6">
      {info.readOnly && (
        <p className="text-xs opacity-60">
          Read-only clock — settings can't be edited from the admin.
        </p>
      )}

      <Group label="Identity">
        <Row title="Name & host" subtitle={`${deviceDisplayName(deviceId)} · ${info.host}`} />
        <Row
          title="Admin build"
          subtitle={`${buildStamp} · this admin server, not the clock`}
        />
      </Group>

      <Group label="Display">
        <Row title="Theme" subtitle={gateNote('theme', undefined)}>
          <div className="flex gap-2" role="group" aria-label="Theme">
            {(['light', 'system', 'dark'] as const).map((t) => (
              <button
                key={t}
                type="button"
                aria-pressed={working.theme === t}
                onClick={() => canEdit('theme') && setWorking({ ...working, theme: t })}
                disabled={!canEdit('theme')}
                className={`flex-1 rounded-md border px-3 py-1.5 text-sm capitalize transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] disabled:cursor-not-allowed disabled:opacity-50 ${
                  working.theme === t
                    ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]'
                    : 'border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))]'
                }`}
              >
                {t === 'system' ? 'auto' : t}
              </button>
            ))}
          </div>
        </Row>

        <Row
          title="Accent"
          subtitle={gateNote('accent', undefined)}
          right={
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={working.accent}
                disabled={!canEdit('accent')}
                onChange={(e) => setWorking({ ...working, accent: e.target.value })}
                aria-label="Accent color"
                className="h-8 w-10 cursor-pointer rounded border border-[hsl(var(--border))] bg-transparent p-0 disabled:cursor-not-allowed disabled:opacity-50"
              />
              <code className="text-xs opacity-70">{working.accent}</code>
            </div>
          }
        />

        <Row
          title="Brightness"
          subtitle={gateNote('brightness', undefined)}
          right={<span className="text-xs opacity-60">{working.brightness ?? 100}%</span>}
        >
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            disabled={!canEdit('brightness')}
            value={working.brightness ?? 100}
            onChange={(e) => setWorking({ ...working, brightness: Number(e.target.value) })}
            aria-label="Brightness"
            className="w-full accent-[hsl(var(--primary))] disabled:cursor-not-allowed disabled:opacity-50"
          />
          <p className="text-xs opacity-60">
            Software dimming of the rendered image — the panel has no backlight control.
          </p>
        </Row>
      </Group>

      <Group label="Night & Sleep">
        <Row
          title="Night mode"
          subtitle={gateNote(
            'night_mode',
            nightEnabled
              ? `${working.night?.start ?? '21:00'} – ${working.night?.end ?? '07:00'} · dim ${working.night?.brightness ?? 30}%`
              : 'off',
          )}
          right={
            <Switch
              checked={nightEnabled}
              disabled={!canEdit('night_mode')}
              aria-label="Night mode"
              onCheckedChange={(on) =>
                setWorking({
                  ...working,
                  night: on ? { start: '21:00', end: '07:00', brightness: 30 } : undefined,
                })
              }
            />
          }
        >
          {nightEnabled && (
            <>
              <div className="flex items-center gap-3 text-sm">
                <label className="flex items-center gap-2">
                  Start
                  <input
                    type="time"
                    value={working.night?.start ?? '21:00'}
                    disabled={!canEdit('night_mode')}
                    onChange={(e) =>
                      setWorking({
                        ...working,
                        night: {
                          start: e.target.value,
                          end: working.night?.end ?? '07:00',
                          brightness: working.night?.brightness,
                        },
                      })
                    }
                    className={timeInputClass}
                  />
                </label>
                <label className="flex items-center gap-2">
                  End
                  <input
                    type="time"
                    value={working.night?.end ?? '07:00'}
                    disabled={!canEdit('night_mode')}
                    onChange={(e) =>
                      setWorking({
                        ...working,
                        night: {
                          start: working.night?.start ?? '21:00',
                          end: e.target.value,
                          brightness: working.night?.brightness,
                        },
                      })
                    }
                    className={timeInputClass}
                  />
                </label>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Night brightness</span>
                <span className="text-xs opacity-60">{working.night?.brightness ?? 30}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                disabled={!canEdit('night_mode')}
                value={working.night?.brightness ?? 30}
                onChange={(e) =>
                  setWorking({
                    ...working,
                    night: {
                      start: working.night?.start ?? '21:00',
                      end: working.night?.end ?? '07:00',
                      brightness: Number(e.target.value),
                    },
                  })
                }
                aria-label="Night brightness"
                className="w-full accent-[hsl(var(--primary))] disabled:cursor-not-allowed disabled:opacity-50"
              />
            </>
          )}
        </Row>

        <Row
          title="Sleep schedule"
          subtitle={gateNote(
            'sleep_schedule',
            sleepEnabled
              ? `wake ${working.sleepSchedule?.wake ?? '07:00'} · sleep ${working.sleepSchedule?.sleep ?? '23:00'}`
              : 'off',
          )}
          right={
            <Switch
              checked={sleepEnabled}
              disabled={!canEdit('sleep_schedule')}
              aria-label="Sleep schedule"
              onCheckedChange={(on) =>
                setWorking({
                  ...working,
                  sleepSchedule: on ? { wake: '07:00', sleep: '23:00' } : undefined,
                })
              }
            />
          }
        >
          {sleepEnabled && (
            <div className="flex items-center gap-3 text-sm">
              <label className="flex items-center gap-2">
                Wake
                <input
                  type="time"
                  value={working.sleepSchedule?.wake ?? '07:00'}
                  disabled={!canEdit('sleep_schedule')}
                  onChange={(e) =>
                    setWorking({
                      ...working,
                      sleepSchedule: {
                        wake: e.target.value,
                        sleep: working.sleepSchedule?.sleep ?? '23:00',
                      },
                    })
                  }
                  className={timeInputClass}
                />
              </label>
              <label className="flex items-center gap-2">
                Sleep
                <input
                  type="time"
                  value={working.sleepSchedule?.sleep ?? '23:00'}
                  disabled={!canEdit('sleep_schedule')}
                  onChange={(e) =>
                    setWorking({
                      ...working,
                      sleepSchedule: {
                        wake: working.sleepSchedule?.wake ?? '07:00',
                        sleep: e.target.value,
                      },
                    })
                  }
                  className={timeInputClass}
                />
              </label>
            </div>
          )}
        </Row>
      </Group>

      {!info.readOnly && (
        <div className="fixed inset-x-0 bottom-6 z-20 flex items-center justify-center gap-2">
          {save.isError && (
            <span className="text-xs text-[hsl(var(--destructive))]">save failed — retry</span>
          )}
          <PushOutcomeChip
            key={save.submittedAt}
            outcome={save.isPending ? null : (save.data?.pushOutcome ?? null)}
          />
          {/* h-11 = 44px sticky-bar tap target */}
          <Button
            className="h-11 px-5"
            onClick={() => save.mutate()}
            disabled={!dirty || save.isPending || !writable}
          >
            {save.isPending ? 'Saving…' : dirty ? 'Save changes' : 'Saved'}
          </Button>
        </div>
      )}
    </div>
  );
}
