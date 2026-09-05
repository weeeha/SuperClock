import { Link, NavLink, Outlet } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { adminApi } from '../lib/api';
import { useDeviceId, useDeviceStatus, deviceDisplayName } from '../lib/device-scope';
import { STATIC_DEVICE_INFO } from '../../shared/capabilities';
import { summarizeRotation } from '../lib/screen-art';
import { cn } from '../lib/cn';

// Control Room layout (wf/2 header, minus P2 items: identify button, uptime).
// Tabs: Playlist (index) / Apps / Settings. Surfaces render in the Outlet.

const TABS = [
  { to: '.', end: true, label: 'Playlist' },
  { to: 'apps', end: false, label: 'Apps' },
  { to: 'settings', end: true, label: 'Settings' },
];

export function ControlRoomShell() {
  const deviceId = useDeviceId();
  const status = useDeviceStatus(deviceId);
  const info = STATIC_DEVICE_INFO[deviceId];
  const cfg = useQuery({
    queryKey: ['device', deviceId],
    queryFn: () => adminApi.getDevice(deviceId),
  });

  return (
    <div className="mx-auto max-w-xl px-4 pb-24">
      <header className="flex items-center gap-3 pt-5 pb-1">
        <Link to="/" aria-label="Back to fleet" className="-ml-1 px-1 text-2xl opacity-70">
          ‹
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">{deviceDisplayName(deviceId)}</h1>
        <span
          aria-label={status.reachable ? 'online' : 'offline'}
          className={cn(
            'h-2.5 w-2.5 rounded-full',
            status.reachable ? 'bg-[hsl(var(--success))]' : 'bg-[hsl(var(--muted-foreground))]',
          )}
        />
        {info.readOnly && (
          <span className="rounded-full bg-[hsl(var(--muted))] px-2 py-0.5 text-xs opacity-80">
            read-only
          </span>
        )}
      </header>
      <p className="pl-6 text-sm opacity-60">{cfg.data ? summarizeRotation(cfg.data) : '…'}</p>

      <nav className="mt-4 flex gap-2" aria-label="Control room tabs">
        {TABS.map((t) => (
          <NavLink
            key={t.label}
            to={t.to}
            end={t.end}
            className={({ isActive }) =>
              cn(
                'rounded-full border border-[hsl(var(--border))] px-4 py-1.5 text-sm',
                isActive
                  ? 'border-transparent bg-[hsl(var(--foreground))] font-semibold text-[hsl(var(--background))]'
                  : 'opacity-80',
              )
            }
          >
            {t.label}
          </NavLink>
        ))}
      </nav>

      {status.known && !status.reachable && !info.readOnly && (
        <div className="mt-4 rounded-md bg-[hsl(var(--warning)/0.1)] p-2.5 text-xs text-[hsl(var(--warning-foreground))]">
          clock unreachable — changes will queue
        </div>
      )}

      <main className="mt-4">
        <Outlet />
      </main>
    </div>
  );
}
