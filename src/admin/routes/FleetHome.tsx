import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { ALL_DEVICE_IDS, type DeviceId, type FleetHealth } from '../../shared/types';
import { adminApi } from '../lib/api';
import { ClockCard, type ClockHealth } from '../components/ClockCard';
import { Button } from '../components/ui/button';

// Fleet Home (wf/1 + wf/9) — the /admin index. Cards iterate the static
// roster so all four clocks render even while config/health load; each card
// degrades honestly from config + health alone (P1: no live device state, no
// activity feed). Failed loads show a cause + retry, never a silent blank.

function healthFor(data: FleetHealth | null | undefined, id: DeviceId): ClockHealth {
  const entry = data?.devices.find((d) => d.id === id);
  if (!entry) return { known: false, reachable: false, lastSeen: null, pending: false };
  return {
    known: true,
    reachable: entry.reachable,
    lastSeen: entry.lastSeen,
    pending: entry.pending,
  };
}

export default function FleetHome() {
  const fleet = useQuery({ queryKey: ['fleet'], queryFn: adminApi.getFleet });
  // Same key + options as useDeviceStatus, so Fleet Home and the control
  // rooms share one 30s visibility-gated health poll.
  const health = useQuery({
    queryKey: ['health'],
    queryFn: adminApi.getFleetHealth,
    refetchInterval: 30_000,
  });

  const online = health.data ? health.data.devices.filter((d) => d.reachable).length : null;
  // adminApi's jsonGet resolves failed requests to null (never throws), so
  // "settled with null data" is the error state here.
  const fleetFailed = !fleet.isPending && fleet.data == null;
  const healthFailed = !health.isPending && health.data == null;

  return (
    <div className="mx-auto max-w-xl px-4 pb-24">
      <header className="pt-5 pb-4">
        <h1 className="text-2xl font-bold tracking-tight">SuperClock</h1>
        <p className="mt-0.5 text-sm opacity-60">
          {ALL_DEVICE_IDS.length} clocks
          {online !== null && ` · ${online} online`}
        </p>
      </header>

      {fleetFailed && healthFailed ? (
        <ErrorStrip
          text="admin API unreachable"
          onRetry={() => {
            void fleet.refetch();
            void health.refetch();
          }}
        />
      ) : (
        <>
          {fleetFailed && (
            <ErrorStrip text="fleet config unavailable" onRetry={() => void fleet.refetch()} />
          )}
          {healthFailed && (
            <ErrorStrip text="clock status unavailable" onRetry={() => void health.refetch()} />
          )}
        </>
      )}

      <ul className="grid grid-cols-2 gap-3">
        {ALL_DEVICE_IDS.map((id) => (
          <li key={id}>
            <ClockCard
              deviceId={id}
              config={fleet.data?.devices.find((d) => d.deviceId === id)}
              health={healthFor(health.data, id)}
            />
          </li>
        ))}
      </ul>

      <Link
        to="/setup"
        className="mt-3 flex items-center justify-center gap-2 rounded-lg border p-4 text-sm text-[hsl(var(--muted-foreground))] transition-colors hover:text-[hsl(var(--foreground))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]"
      >
        <Plus size={16} aria-hidden />
        Set up a new clock
      </Link>
    </div>
  );
}

function ErrorStrip({ text, onRetry }: { text: string; onRetry: () => void }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3 rounded-md bg-[hsl(var(--warning)/0.1)] p-2.5 text-xs text-[hsl(var(--warning-foreground))]">
      <span>{text}</span>
      <Button size="sm" variant="secondary" onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}
