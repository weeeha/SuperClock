import { describe, it, expect } from 'vitest';
import { classifyPush } from './device-push';

describe('classifyPush — dev-safety guard', () => {
  it('production always pushes', () => {
    expect(classifyPush('superclock-small', 'superclock-fast', 'production', false)).toBe('push');
  });
  it('dev pushing to itself pushes', () => {
    expect(classifyPush('superclock-fast', 'superclock-fast', undefined, false)).toBe('push');
  });
  it('dev pushing to a REMOTE device is suppressed (the real-clock trap)', () => {
    expect(classifyPush('superclock-small', 'superclock-fast', undefined, false)).toBe('suppress');
    expect(classifyPush('superclock-small', 'superclock-fast', 'development', false)).toBe('suppress');
  });
  it('ADMIN_ALLOW_REMOTE_WRITES=1 overrides the suppression', () => {
    expect(classifyPush('superclock-small', 'superclock-fast', undefined, true)).toBe('push');
  });
});
