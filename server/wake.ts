// The kiosk asks its own server to keep the panel on while an alert rings or
// is about to (spec 2026-10-02-alarm-design.md, core change 3). Loopback-only:
// the kiosk has no admin token, and only the Pi itself may call this.
import { z } from 'zod';

export const MAX_WAKE_MS = 30 * 60_000;

const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

export function isLoopback(addr: string | undefined): boolean {
  return addr !== undefined && LOOPBACK.has(addr);
}

export const wakeBodySchema = z.object({ untilMs: z.number().finite() });

export function clampWake(untilMs: number, now: number): number {
  return Math.min(Math.max(untilMs, now), now + MAX_WAKE_MS);
}
