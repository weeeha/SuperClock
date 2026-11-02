// @vitest-environment jsdom
// An app that is mid-session (a running timer, a workout, an alarm being
// edited) asks the idle return to wait. The hold follows the same guarded
// cleanup as verticalSwipeCallback: SwipeContainer's popLayout keeps the
// exiting app mounted after the next one registers, so an exiting app may
// only release a hold it still owns.
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useNavigation } from '../navigation';
import { useHomeHold } from './useHomeHold';

beforeEach(() => {
  useNavigation.setState({ homeHold: null });
});

describe('useHomeHold', () => {
  it('holds while the session runs and releases when it stops', () => {
    const { rerender } = renderHook(({ on }) => useHomeHold('timer', on), {
      initialProps: { on: true },
    });
    expect(useNavigation.getState().homeHold).toBe('timer');
    rerender({ on: false });
    expect(useNavigation.getState().homeHold).toBe(null);
  });

  it('releases on unmount', () => {
    const { unmount } = renderHook(() => useHomeHold('fitness', true));
    expect(useNavigation.getState().homeHold).toBe('fitness');
    unmount();
    expect(useNavigation.getState().homeHold).toBe(null);
  });

  it('an exiting app never releases the hold the incoming app took', () => {
    const exiting = renderHook(() => useHomeHold('timer', true));
    renderHook(() => useHomeHold('fitness', true));
    expect(useNavigation.getState().homeHold).toBe('fitness');
    exiting.unmount();
    expect(useNavigation.getState().homeHold).toBe('fitness');
  });

  it('does nothing while inactive', () => {
    renderHook(() => useHomeHold('timer', false));
    expect(useNavigation.getState().homeHold).toBe(null);
  });
});
