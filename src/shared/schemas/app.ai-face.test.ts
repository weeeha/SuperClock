import { describe, it, expect } from 'vitest';
import { aiFaceAppSchema } from './app.ai-face';

describe('app.ai-face schema', () => {
  it('defaults to a demo of Wheatley that sleeps at night', () => {
    expect(aiFaceAppSchema.parse({})).toEqual({
      design: 'core-eyes/wheatley',
      source: 'demo',
      activity: 'idle',
      expression: 'neutral',
      showTime: false,
      sleepAtNight: true,
    });
  });

  it('accepts every registered design id', () => {
    expect(aiFaceAppSchema.safeParse({ design: 'fractal-presence/fractal-presence' }).success).toBe(true);
  });

  it('rejects a design this build does not know, so the app falls back to defaults', () => {
    expect(aiFaceAppSchema.safeParse({ design: 'oracle/oracle' }).success).toBe(false);
  });
});
