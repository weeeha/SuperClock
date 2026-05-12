import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Grid3x3, ListOrdered, Settings } from 'lucide-react';
import { cn } from '../lib/cn';

const TABS = [
  { to: '/', label: 'Dashboard', Icon: LayoutDashboard, end: true },
  { to: '/apps', label: 'Apps', Icon: Grid3x3, end: false },
  { to: '/playlist', label: 'Playlist', Icon: ListOrdered, end: false },
  { to: '/settings', label: 'Settings', Icon: Settings, end: false },
];

export function NavTabs() {
  return (
    <nav className="fixed bottom-4 left-1/2 z-30 -translate-x-1/2 rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-2 py-2 shadow-lg">
      <div className="flex items-center gap-1">
        {TABS.map(({ to, label, Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                'flex items-center justify-center rounded-full p-2 transition-colors',
                isActive
                  ? 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]'
                  : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]',
              )
            }
            aria-label={label}
          >
            <Icon className="h-5 w-5" />
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
