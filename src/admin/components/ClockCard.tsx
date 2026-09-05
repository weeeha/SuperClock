import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import type { DeviceConfig, DeviceId } from '../../shared/types';
import { STATIC_DEVICE_INFO } from '../../shared/capabilities';
import { deviceDisplayName } from '../lib/device-scope';
import { artForInstance, summarizeRotation } from '../lib/screen-art';
import { Card } from './ui/card';
import { cn } from '../lib/cn';

// Fleet Home clock card (wf/1 happy path + wf/9 degraded states). Shape-aware:
// superclock-square gets a square art frame, the round devices a circle — the
// frame mirrors the glass. P1 honesty rules: art comes from CONFIG (first
// playlist entry — device state is a stub until P2), the "now: X" line is the
// rotation summary config can vouch for, and a clock the health poll hasn't
// confirmed renders as unknown ("…"), never as online.

/** Per-device slice of the shared ['health'] poll. `known` is false until the
 *  first health response arrives (or after it fails). `pending` mirrors the
 *  server's queued-push flag — config saved but not yet delivered. */
export interface ClockHealth {
  known: boolean;
  reachable: boolean;
  lastSeen: string | null;
  pending: boolean;
}

/** Compact age for the "offline · 2d" line. Re-evaluated on each health poll
 *  render — no timer (admin surfaces don't tick). */
function sinceShort(iso: string): string {
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

const GRAY_DOT = 'bg-[hsl(var(--muted-foreground))]';

interface StatusLine {
  dot: string;
  text: string;
  online: boolean;
}

function statusLine(health: ClockHealth, config: DeviceConfig | undefined): StatusLine {
  if (!health.known) return { dot: GRAY_DOT, text: '…', online: false };
  if (health.pending) {
    // wf/9: a queued config write outranks plain offline on the card; the
    // control room's banner carries the retry detail.
    return { dot: 'bg-[hsl(var(--warning))]', text: 'config pending', online: false };
  }
  if (!health.reachable) {
    return {
      dot: GRAY_DOT,
      text: health.lastSeen ? `offline · ${sinceShort(health.lastSeen)}` : 'offline',
      online: false,
    };
  }
  return { dot: 'bg-[hsl(var(--success))]', text: config ? summarizeRotation(config) : '…', online: true };
}

function firstScreenArt(cfg: DeviceConfig) {
  return artForInstance(cfg.instances.find((i) => i.id === cfg.playlist.items[0]));
}

interface ClockCardProps {
  deviceId: DeviceId;
  /** undefined while the fleet config is loading or failed to load. */
  config: DeviceConfig | undefined;
  health: ClockHealth;
}

export function ClockCard({ deviceId, config, health }: ClockCardProps) {
  const info = STATIC_DEVICE_INFO[deviceId];
  const art = config ? firstScreenArt(config) : null;
  const status = statusLine(health, config);
  // Dim = the offline presentation (wf/9 "honest offline"); the pending
  // presentation keeps full-strength art so amber is the card's one signal.
  const dimmed = health.known && !health.reachable && !health.pending;

  return (
    <Link
      to={`/clock/${deviceId}`}
      className="block h-full rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]"
    >
      <Card className="h-full p-3">
        <div
          className={cn(
            'mx-auto my-2 flex aspect-square w-4/5 items-center justify-center overflow-hidden border bg-[hsl(var(--muted))]',
            deviceId === 'superclock-square' ? 'rounded-lg' : 'rounded-full',
            dimmed && 'opacity-50',
          )}
        >
          {art?.src ? (
            <img src={art.src} alt={art.label} className="h-full w-full object-cover" />
          ) : (
            // No art (empty playlist / art-less app) → the label, never fake
            // art. While config is still loading there is no claim to make.
            <span className="px-3 text-center text-xs text-[hsl(var(--muted-foreground))]">
              {art ? art.label : ''}
            </span>
          )}
        </div>

        <div className="mt-2 flex items-center gap-1">
          <h2 className="min-w-0 flex-1 truncate text-base font-semibold">
            {deviceDisplayName(deviceId)}
          </h2>
          <ChevronRight
            size={16}
            aria-hidden
            className="shrink-0 text-[hsl(var(--muted-foreground))]"
          />
        </div>

        <p className="mt-1 flex items-center gap-1.5 text-xs text-[hsl(var(--muted-foreground))]">
          <span aria-hidden className={cn('h-2.5 w-2.5 shrink-0 rounded-full', status.dot)} />
          {status.online && <span className="sr-only">online</span>}
          <span className="truncate">{status.text}</span>
        </p>

        {info.readOnly && (
          <p className="mt-2">
            <span className="rounded-full bg-[hsl(var(--muted))] px-2 py-0.5 text-xs opacity-80">
              read-only
            </span>
          </p>
        )}
      </Card>
    </Link>
  );
}
