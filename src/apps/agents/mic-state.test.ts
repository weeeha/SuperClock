import { describe, it, expect } from 'vitest';
import { MIC_STATES, nextMicState } from './mic-state';

describe('mic state cycle', () => {
  it('cycles idle → listening → thinking → speaking → idle', () => {
    expect(MIC_STATES).toEqual(['idle', 'listening', 'thinking', 'speaking']);
    expect(nextMicState('idle')).toBe('listening');
    expect(nextMicState('speaking')).toBe('idle');
  });
});
