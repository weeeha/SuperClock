// @vitest-environment jsdom
// The transition contract: every action that enters mode 'transitioning'
// relies on AnimatePresence's onExitComplete to call finishTransition().
// When nothing is on screen to exit, that callback never fires and every
// gesture dies, because they all gate on mode. Seen live 2026-11-01: a
// kiosk booting with a pinned playlist switches instance in the first effect
// pass, before any app child has mounted, and sits in 'transitioning' until
// a three-finger tap (fastclock, Rally pinned since 2026-10-30).
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup, act } from '@testing-library/react';
import { useNavigation } from '../navigation';
import SwipeContainer, { TRANSITION_WATCHDOG_MS } from './SwipeContainer';
import '../../apps';

beforeEach(() => {
  useNavigation.setState({
    mode: 'app', activeAppId: '', activeInstanceId: null, transitionDirection: null,
    settingsOpen: false, backCallback: null, peek: null, verticalSwipeCallback: null, homeHold: null,
  });
  useNavigation.getState().initApps();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('SwipeContainer transition contract', () => {
  it('finishes a transition that has nothing to exit (boot with a pinned playlist)', async () => {
    useNavigation.setState({ activeAppId: '' }); // first render: no app on screen yet
    render(<SwipeContainer />);
    act(() => {
      useNavigation.getState().initApps();
      useNavigation.getState().switchToInstance('i-pinned', 'quote');
    });
    expect(useNavigation.getState().activeInstanceId).toBe('i-pinned');
    await act(async () => {});
    expect(useNavigation.getState().mode).toBe('app');
  });

  it('finishes a transition whose render key did not change', async () => {
    render(<SwipeContainer />);
    await act(async () => {});
    act(() => useNavigation.setState({ mode: 'transitioning', transitionDirection: 'left' }));
    await act(async () => {});
    expect(useNavigation.getState().mode).toBe('app');
  });

  it('lets a real exit finish the transition, with a watchdog if it never does', () => {
    vi.useFakeTimers();
    render(<SwipeContainer />);
    act(() => useNavigation.getState().swipeToNext());
    expect(useNavigation.getState().mode).toBe('transitioning');
    act(() => { vi.advanceTimersByTime(TRANSITION_WATCHDOG_MS + 50); });
    expect(useNavigation.getState().mode).toBe('app');
  });
});
