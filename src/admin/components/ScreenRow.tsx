import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { EllipsisVertical, GripVertical, Pencil, Trash2 } from 'lucide-react';
import type { ScreenInstance } from '../../shared/types';
import { artForInstance } from '../lib/screen-art';
import { cn } from '../lib/cn';

// Playlist row (wf/2): art thumb · title/subtitle · overflow menu · drag
// handle. P1 omissions are deliberate: no schedule strip and no "new" pill
// (P3), no "now" badge (device state is a stub until P2 telemetry).

const APP_NAME_OVERRIDES: Record<string, string> = { github: 'GitHub' };

// screen-art.ts keeps its humanizer private; this local copy (plus the GitHub
// casing fix) is a reported composition gap — promote a shared appDisplayName
// in integration if other surfaces grow one too.
function appDisplayName(appId: string): string {
  return (
    APP_NAME_OVERRIDES[appId] ??
    appId
      .split('-')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ')
  );
}

interface ScreenRowProps {
  instance: ScreenInstance;
  /** Offline or read-only device: reorder + remove are disabled; edit stays (navigation, not a write). */
  writesDisabled: boolean;
  onRemove: (instance: ScreenInstance) => void;
}

export function ScreenRow({ instance, writesDisabled, onRemove }: ScreenRowProps) {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: instance.id,
    disabled: writesDisabled,
  });

  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [menuOpen]);

  const art = artForInstance(instance);
  // App rows title with the properly-cased app name (screen-art's humanizer
  // says "Github"); clock rows keep the face-aware art label.
  const title =
    instance.appId === 'clock' ? art.label : (instance.label ?? appDisplayName(instance.appId));
  const subtitle = instance.appId === 'clock' ? 'Clock face' : appDisplayName(instance.appId);

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'relative flex items-center gap-3 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-3',
        isDragging && 'opacity-70',
        (isDragging || menuOpen) && 'z-10',
      )}
    >
      {art.src ? (
        <img
          src={art.src}
          alt=""
          className="h-12 w-12 shrink-0 rounded-full bg-[hsl(var(--muted))] object-cover"
        />
      ) : (
        <div
          aria-hidden="true"
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--muted))] text-sm font-semibold opacity-60"
        >
          {title.charAt(0).toUpperCase()}
        </div>
      )}

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{title}</p>
        {subtitle !== title && <p className="truncate text-xs opacity-60">{subtitle}</p>}
      </div>

      <div ref={menuRef} className="relative shrink-0">
        <button
          onClick={() => setMenuOpen((o) => !o)}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          aria-label={`Screen actions: ${title}`}
          className="flex h-8 w-8 items-center justify-center rounded-md opacity-60 hover:bg-[hsl(var(--muted))] hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]"
        >
          <EllipsisVertical className="h-4 w-4" />
        </button>
        {menuOpen && (
          <div
            role="menu"
            className="absolute right-0 top-9 z-20 w-44 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--popover))] py-1 shadow-lg"
          >
            <button
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                navigate(`screens/${instance.id}`);
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-[hsl(var(--muted))] focus-visible:bg-[hsl(var(--muted))] focus-visible:outline-none"
            >
              <Pencil className="h-4 w-4 opacity-60" /> Edit screen
            </button>
            <button
              role="menuitem"
              disabled={writesDisabled}
              onClick={() => {
                setMenuOpen(false);
                onRemove(instance);
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-[hsl(var(--destructive))] hover:bg-[hsl(var(--muted))] focus-visible:bg-[hsl(var(--muted))] focus-visible:outline-none disabled:opacity-40"
            >
              <Trash2 className="h-4 w-4" /> Remove screen
            </button>
          </div>
        )}
      </div>

      <button
        {...attributes}
        {...listeners}
        disabled={writesDisabled}
        aria-label={`Drag to reorder ${title}`}
        className="flex h-8 w-8 shrink-0 cursor-grab touch-none items-center justify-center rounded-md opacity-60 hover:bg-[hsl(var(--muted))] hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] active:cursor-grabbing disabled:cursor-default disabled:opacity-30"
      >
        <GripVertical className="h-4 w-4" />
      </button>
    </div>
  );
}
