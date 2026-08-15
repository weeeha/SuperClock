import type { DeviceConfig, ScreenInstance } from '../../shared/types';
import { getFace } from '../../shared/face-registry';
import { APP_ICONS } from '../../shared/app-icons';

// P1 renders static registry art only (spec: previews = face-registry PNGs /
// app grid icons; live components arrive in P2 into the same slots).

export interface ScreenArt {
  src: string | null;
  label: string;
}

function humanize(id: string): string {
  return id
    .split('-')
    .map((p) => p[0].toUpperCase() + p.slice(1))
    .join(' ');
}

export function artForInstance(inst: ScreenInstance | undefined): ScreenArt {
  if (!inst) return { src: null, label: 'empty' };
  if (inst.appId === 'clock') {
    const faceId = typeof inst.config.faceId === 'string' ? inst.config.faceId : undefined;
    const face = faceId ? getFace(faceId) : undefined;
    return { src: face?.preview ?? null, label: inst.label ?? face?.name ?? 'Clock' };
  }
  return { src: APP_ICONS[inst.appId] ?? null, label: inst.label ?? humanize(inst.appId) };
}

/** Honest P1 substitute for the "now: X" line — device state is a stub until
 *  P2 telemetry, so the card reports what config KNOWS: screen count and
 *  rotation. */
export function summarizeRotation(cfg: DeviceConfig): string {
  const n = cfg.playlist.items.length;
  const rot = cfg.playlist.rotationSeconds;
  return `${n} ${n === 1 ? 'screen' : 'screens'} · ${rot ? `${rot}s` : 'manual'}`;
}
