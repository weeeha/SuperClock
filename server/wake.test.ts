import { describe, it, expect } from 'vitest';
import { clampWake, isLoopback, MAX_WAKE_MS, wakeBodySchema } from './wake';

describe('wake helpers', () => {
  it('accepts loopback callers only', () => {
    for (const addr of ['127.0.0.1', '::1', '::ffff:127.0.0.1']) expect(isLoopback(addr)).toBe(true);
    for (const addr of ['192.168.4.30', '100.78.29.28', '', undefined]) expect(isLoopback(addr)).toBe(false);
  });
  it('clamps a wake to at most 30 minutes ahead, never into the past', () => {
    expect(clampWake(5000, 1000)).toBe(5000);
    expect(clampWake(500, 1000)).toBe(1000);
    expect(clampWake(1000 + MAX_WAKE_MS + 1, 1000)).toBe(1000 + MAX_WAKE_MS);
  });
  it('validates the body', () => {
    expect(wakeBodySchema.safeParse({ untilMs: 123 }).success).toBe(true);
    expect(wakeBodySchema.safeParse({ untilMs: '123' }).success).toBe(false);
    expect(wakeBodySchema.safeParse({}).success).toBe(false);
  });
});
