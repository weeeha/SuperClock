import { describe, it, expect, vi } from 'vitest';

vi.mock('./radar/service', () => ({
  getPresenceState: () => ({ available: false, present: null, lastSeenMs: 0 }),
  onPresenceTransition: () => () => {},
}));

import { decidePower } from './display-adapter';
import type { DeviceConfig } from '../src/shared/types';

const config = {
  settings: { theme: 'system', accent: '#ff6b35', sleepSchedule: { wake: '07:00', sleep: '22:00' } },
} as unknown as DeviceConfig;
const night = new Date(2026, 9, 2, 3, 0, 0);
const noon = new Date(2026, 9, 2, 12, 0, 0);

describe('decidePower', () => {
  it('follows the sleep schedule without a wake', () => {
    expect(decidePower(config, night, 0)).toBe(false);
    expect(decidePower(config, noon, 0)).toBe(true);
  });
  it('stays on inside a wake, then returns to the schedule', () => {
    expect(decidePower(config, night, night.getTime() + 60_000)).toBe(true);
    expect(decidePower(config, night, night.getTime() - 1)).toBe(false);
  });
});
