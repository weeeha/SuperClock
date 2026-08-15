import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronRight } from 'lucide-react';
import { Switch } from '../components/ui/switch';
import { Button } from '../components/ui/button';
import { PushOutcomeChip } from '../components/PushOutcomeChip';
import { adminApi } from '../lib/api';
import { useDeviceId, useDeviceStatus } from '../lib/device-scope';
import { appDisplayName } from '../lib/app-names';
import { buildCapabilities } from '../../shared/capabilities';
import { APP_ICONS } from '../../shared/app-icons';
import { cn } from '../lib/cn';
import type { PushOutcome } from '../../shared/types';

// Apps tab (wf/5-apps-tab): which apps live on this clock. The switch edits
// `enabledApps`; rows drill into App Detail. Renders inside ControlRoomShell.

/** Icon circle; apps without grid art (e.g. breathing) fall back to a letter. */
function AppArt({ appId }: { appId: string }) {
  const src = APP_ICONS[appId];
  return (
    <span
      aria-hidden
      className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[hsl(var(--muted))]"
    >
      {src ? (
        <img src={src} alt="" className="h-full w-full object-cover" />
      ) : (
        <span className="text-sm font-medium opacity-60">{appDisplayName(appId)[0]}</span>
      )}
    </span>
  );
}

function screensSubtitle(count: number): string {
  if (count === 0) return 'no screens';
  return `${count} ${count === 1 ? 'screen' : 'screens'}`;
}

export default function AppsTab() {
  const deviceId = useDeviceId();
  const status = useDeviceStatus(deviceId);
  const queryClient = useQueryClient();
  const [lastOutcome, setLastOutcome] = useState<PushOutcome | null>(null);

  const deviceQ = useQuery({
    queryKey: ['device', deviceId],
    queryFn: () => adminApi.getDevice(deviceId),
  });

  const toggle = useMutation({
    mutationFn: async ({ appId, enabled }: { appId: string; enabled: boolean }) => {
      // Kiosk semantics: an EMPTY enabledApps means "all apps enabled"
      // (fresh-device default). Turning one app off from that state must
      // therefore materialize the full list first, or the write is a no-op.
      const stored = deviceQ.data?.enabledApps ?? [];
      const current =
        stored.length > 0 ? stored : buildCapabilities(deviceId).apps.map((a) => a.id);
      const next = enabled
        ? Array.from(new Set([...current, appId]))
        : current.filter((id) => id !== appId);
      return adminApi.patchDevice(deviceId, { enabledApps: next });
    },
    onSuccess: (result) => {
      queryClient.setQueryData(['device', deviceId], result.config);
      setLastOutcome(result.pushOutcome);
    },
  });

  const caps = buildCapabilities(deviceId);
  const offline = status.known && !status.reachable;
  const supportedIds = caps.apps.map((a) => a.id);

  if (deviceQ.isPending) {
    return (
      <div className="space-y-2" aria-busy="true">
        <p className="sr-only">Loading apps</p>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-16 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))]"
          />
        ))}
      </div>
    );
  }

  const cfg = deviceQ.data;
  if (!cfg) {
    return (
      <div className="rounded-lg border border-[hsl(var(--border))] p-4">
        <p className="text-sm opacity-70">Couldn&apos;t load this clock&apos;s config.</p>
        <Button variant="outline" size="sm" className="mt-3" onClick={() => deviceQ.refetch()}>
          Retry
        </Button>
      </div>
    );
  }

  // Empty stored list = all supported apps enabled (mirror the kiosk).
  const stored = cfg.enabledApps;
  const enabled = new Set(stored.length > 0 ? stored : supportedIds);
  const enabledIds = supportedIds.filter((id) => enabled.has(id));
  const counts = new Map<string, number>();
  for (const inst of cfg.instances) {
    counts.set(inst.appId, (counts.get(inst.appId) ?? 0) + 1);
  }

  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-xs font-medium uppercase tracking-wide opacity-60">
          On this clock · {enabledIds.length}
        </h2>
        <ul className="mt-2 flex flex-wrap gap-2">
          {enabledIds.map((id) => (
            <li key={id} className="rounded-full bg-[hsl(var(--muted))] px-3 py-1 text-sm">
              {appDisplayName(id)}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <div className="flex items-center gap-2">
          <h2 className="text-xs font-medium uppercase tracking-wide opacity-60">All apps</h2>
          <PushOutcomeChip outcome={lastOutcome} />
        </div>
        <ul className="mt-2 space-y-2">
          {supportedIds.map((appId) => {
            const isOn = enabled.has(appId);
            return (
              <li
                key={appId}
                className={cn(
                  'flex items-center rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] transition-colors hover:bg-[hsl(var(--muted))]',
                  !caps.readOnly && 'pr-3',
                )}
              >
                <Link
                  to={`/clock/${deviceId}/apps/${appId}`}
                  className="flex min-w-0 flex-1 items-center gap-3 rounded-lg p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]"
                >
                  <AppArt appId={appId} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {appDisplayName(appId)}
                    </span>
                    <span className="block text-xs opacity-60">
                      {isOn ? screensSubtitle(counts.get(appId) ?? 0) : 'off'}
                    </span>
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 opacity-40" aria-hidden />
                </Link>
                {!caps.readOnly && (
                  <Switch
                    checked={isOn}
                    onCheckedChange={(next) => toggle.mutate({ appId, enabled: next })}
                    disabled={toggle.isPending || offline}
                    aria-label={`${appDisplayName(appId)} on this clock`}
                  />
                )}
              </li>
            );
          })}
        </ul>
        {toggle.isError && (
          <p className="mt-2 text-sm text-[hsl(var(--destructive))]">
            Couldn&apos;t save — {(toggle.error as Error).message}
          </p>
        )}
        {!caps.readOnly && (
          <p className="mt-4 text-center text-xs opacity-60">
            Off hides the app from this clock&apos;s swipe order.
          </p>
        )}
      </section>
    </div>
  );
}
