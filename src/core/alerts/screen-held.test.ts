import { describe, it, expect } from 'vitest';
import { selectScreenHeld, type AlertState, type ScheduledAlert } from './alert-store';
import { registerLeadView } from './views';

registerLeadView('lead-app', () => null);

const alert = (appId: string): ScheduledAlert => ({ id: 'x', appId, firesAt: 10, sound: false, payload: {}, leadMs: 5 });
const base: Pick<AlertState, 'scheduled' | 'ringing' | 'leading' | 'leadHidden'> = {
  scheduled: [], ringing: null, leading: null, leadHidden: false,
};

describe('selectScreenHeld', () => {
  it('holds the screen while an alert rings', () => {
    expect(selectScreenHeld({ ...base, ringing: { ...alert('timer'), firedAt: 10, settled: false } })).toBe(true);
  });
  it('holds it while a registered lead view shows, not once hidden', () => {
    expect(selectScreenHeld({ ...base, scheduled: [alert('lead-app')], leading: 'x' })).toBe(true);
    expect(selectScreenHeld({ ...base, scheduled: [alert('lead-app')], leading: 'x', leadHidden: true })).toBe(false);
  });
  it('does not hold it for a lead whose app has no lead view', () => {
    expect(selectScreenHeld({ ...base, scheduled: [alert('timer')], leading: 'x' })).toBe(false);
  });
  it('is free when nothing is happening', () => {
    expect(selectScreenHeld(base)).toBe(false);
  });
});
