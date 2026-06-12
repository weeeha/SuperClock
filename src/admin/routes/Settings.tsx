import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Switch } from '../components/ui/switch';
import { adminApi } from '../lib/api';
import { useActiveDevice } from '../store/active-device';
import { STATIC_DEVICE_INFO } from '../../shared/capabilities';
import type { DeviceConfig, FeatureFlag } from '../../shared/types';

type SettingsShape = DeviceConfig['settings'];

const DEFAULTS: SettingsShape = {
  theme: 'dark',
  accent: '#ff6b35',
  brightness: 80,
  sleepSchedule: undefined,
  night: undefined,
};

export default function Settings() {
  const { activeDeviceId } = useActiveDevice();
  const queryClient = useQueryClient();
  const info = STATIC_DEVICE_INFO[activeDeviceId];
  const has = (flag: FeatureFlag) => info.features.includes(flag);

  const deviceQ = useQuery({
    queryKey: ['device', activeDeviceId],
    queryFn: () => adminApi.getDevice(activeDeviceId),
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
    mutationFn: () => adminApi.patchDevice(activeDeviceId, { settings: working }),
    onSuccess: (updated) => queryClient.setQueryData(['device', activeDeviceId], updated),
  });

  const dirty = JSON.stringify(working) !== JSON.stringify(initial);
  const sleepEnabled = Boolean(working.sleepSchedule);
  const nightEnabled = Boolean(working.night);

  return (
    <div className="space-y-6 p-6 pb-32">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          Display settings for <span className="font-medium">{activeDeviceId}</span>.
        </p>
      </header>

      {info.readOnly && (
        <Card className="border-[hsl(var(--destructive))]/40">
          <CardContent className="pt-6 text-sm">
            <span className="font-medium">Read-only.</span> This device exposes capabilities and state
            but doesn't accept config pushes in v1. Changes here are saved to the fleet but won't take
            effect on the device.
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>General</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Theme</label>
            <div className="flex gap-2">
              {(['light', 'system', 'dark'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => has('theme') && setWorking({ ...working, theme: t })}
                  disabled={!has('theme')}
                  className={`flex-1 rounded-md border px-3 py-1.5 text-sm capitalize transition-colors disabled:opacity-50 ${
                    working.theme === t
                      ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]'
                      : 'border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))]'
                  }`}
                >
                  {t === 'system' ? 'auto' : t}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">Accent color</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={working.accent}
                disabled={!has('accent')}
                onChange={(e) => setWorking({ ...working, accent: e.target.value })}
                className="h-8 w-12 cursor-pointer rounded-md border border-[hsl(var(--border))] bg-transparent disabled:cursor-not-allowed disabled:opacity-50"
              />
              <code className="text-xs opacity-60">{working.accent}</code>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Display</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Brightness</label>
              <span className="text-xs opacity-60">{working.brightness ?? 0}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              disabled={!has('brightness')}
              value={working.brightness ?? 80}
              onChange={(e) =>
                setWorking({ ...working, brightness: Number(e.target.value) })
              }
              className="w-full disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Sleep schedule</label>
              <Switch
                checked={sleepEnabled}
                disabled={!has('sleep_schedule')}
                onCheckedChange={(on) =>
                  setWorking({
                    ...working,
                    sleepSchedule: on ? { wake: '07:00', sleep: '23:00' } : undefined,
                  })
                }
              />
            </div>
            {sleepEnabled && (
              <div className="flex items-center gap-3 text-sm">
                <label className="flex items-center gap-2">
                  Wake
                  <input
                    type="time"
                    value={working.sleepSchedule?.wake ?? '07:00'}
                    onChange={(e) =>
                      setWorking({
                        ...working,
                        sleepSchedule: {
                          wake: e.target.value,
                          sleep: working.sleepSchedule?.sleep ?? '23:00',
                        },
                      })
                    }
                    className="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-2 py-1"
                  />
                </label>
                <label className="flex items-center gap-2">
                  Sleep
                  <input
                    type="time"
                    value={working.sleepSchedule?.sleep ?? '23:00'}
                    onChange={(e) =>
                      setWorking({
                        ...working,
                        sleepSchedule: {
                          wake: working.sleepSchedule?.wake ?? '07:00',
                          sleep: e.target.value,
                        },
                      })
                    }
                    className="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-2 py-1"
                  />
                </label>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Night mode</label>
              <Switch
                checked={nightEnabled}
                disabled={!has('night_mode')}
                onCheckedChange={(on) =>
                  setWorking({
                    ...working,
                    night: on ? { start: '21:00', end: '07:00', brightness: 30 } : undefined,
                  })
                }
              />
            </div>
            {nightEnabled && (
              <>
                <div className="flex items-center gap-3 text-sm">
                  <label className="flex items-center gap-2">
                    Start
                    <input
                      type="time"
                      value={working.night?.start ?? '21:00'}
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
                      className="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-2 py-1"
                    />
                  </label>
                  <label className="flex items-center gap-2">
                    End
                    <input
                      type="time"
                      value={working.night?.end ?? '07:00'}
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
                      className="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-2 py-1"
                    />
                  </label>
                </div>
                <div className="flex items-center justify-between">
                  <label className="text-sm">Night brightness</label>
                  <span className="text-xs opacity-60">{working.night?.brightness ?? 30}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  disabled={!has('night_mode')}
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
                  className="w-full disabled:cursor-not-allowed disabled:opacity-50"
                />
              </>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="fixed bottom-20 left-1/2 z-20 -translate-x-1/2">
        <Button onClick={() => save.mutate()} disabled={!dirty || save.isPending}>
          {save.isPending ? 'Saving…' : dirty ? 'Save changes' : 'Saved'}
        </Button>
      </div>
    </div>
  );
}
