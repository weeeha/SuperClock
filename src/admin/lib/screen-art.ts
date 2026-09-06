import type { DeviceConfig, ScreenInstance } from '../../shared/types';
import { getFace } from '../../shared/face-registry';
import { APP_ICONS } from '../../shared/app-icons';
import { appDisplayName } from './app-names';

// P1 renders static registry art only (spec: previews = face-registry PNGs /
// app grid icons; live components arrive in P2 into the same slots).

export interface ScreenArt {
  src: string | null;
  label: string;
}

export function artForInstance(inst: ScreenInstance | undefined): ScreenArt {
  if (!inst) return { src: null, label: 'empty' };
  if (inst.appId === 'clock') {
    const faceId = typeof inst.config.faceId === 'string' ? inst.config.faceId : undefined;
    const face = faceId ? getFace(faceId) : undefined;
    return { src: face?.preview ?? null, label: inst.label ?? face?.name ?? 'Clock' };
  }
  return { src: APP_ICONS[inst.appId] ?? null, label: inst.label ?? appDisplayName(inst.appId) };
}

/** Honest P1 substitute for the "now: X" line — device state is a stub until
 *  P2 telemetry, so the card reports what config KNOWS: screen count and
 *  rotation. Counts only playlist ids that resolve to a real instance, so a
 *  stale id under corrupt config can't inflate the number. */
export function summarizeRotation(cfg: DeviceConfig): string {
  const known = new Set(cfg.instances.map((i) => i.id));
  const n = cfg.playlist.items.filter((id) => known.has(id)).length;
  const rot = cfg.playlist.rotationSeconds;
  return `${n} ${n === 1 ? 'screen' : 'screens'} · ${rot ? `${rot}s` : 'manual'}`;
}
