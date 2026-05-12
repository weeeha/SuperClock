import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { adminApi } from '../lib/api';
const { getOwnCapabilities, getFleetHealth } = adminApi;
import { useActiveDevice } from '../store/active-device';

export default function Dashboard() {
  const { activeDeviceId } = useActiveDevice();
  const caps = useQuery({ queryKey: ['caps'], queryFn: getOwnCapabilities });
  const health = useQuery({ queryKey: ['health'], queryFn: getFleetHealth });

  return (
    <div className="space-y-6 p-6 pb-24">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          Active device: <span className="font-medium">{activeDeviceId}</span>
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>This device</CardTitle>
            <CardDescription>Capabilities reported by the admin host</CardDescription>
          </CardHeader>
          <CardContent>
            {caps.isLoading && <p className="text-sm opacity-60">Loading…</p>}
            {caps.data && (
              <dl className="grid grid-cols-2 gap-2 text-sm">
                <dt className="opacity-60">id</dt>
                <dd>{caps.data.id}</dd>
                <dt className="opacity-60">kind</dt>
                <dd>{caps.data.kind}</dd>
                <dt className="opacity-60">host</dt>
                <dd>{caps.data.host}</dd>
                <dt className="opacity-60">apps</dt>
                <dd>{caps.data.apps.length}</dd>
                <dt className="opacity-60">faces</dt>
                <dd>{caps.data.apps.find((a) => a.id === 'clock')?.faces?.length ?? 0}</dd>
              </dl>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Fleet health</CardTitle>
            <CardDescription>From /api/admin/health (wired in step 5)</CardDescription>
          </CardHeader>
          <CardContent>
            {health.isLoading && <p className="text-sm opacity-60">Loading…</p>}
            {!health.data && !health.isLoading && (
              <p className="text-sm opacity-60">No fleet endpoint yet.</p>
            )}
            {health.data && (
              <ul className="space-y-1 text-sm">
                {health.data.devices.map((d) => (
                  <li key={d.id} className="flex justify-between">
                    <span>{d.id}</span>
                    <span className={d.reachable ? 'text-green-400' : 'opacity-50'}>
                      {d.reachable ? 'online' : 'offline'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
