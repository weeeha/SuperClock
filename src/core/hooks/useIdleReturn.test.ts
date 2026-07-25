import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { useNavigation } from '../navigation';
import { checkIdle, OVERLAY_IDLE_MS, HOME_IDLE_MS } from './useIdleReturn';
import '../../apps';

beforeEach(() => {
  vi.useFakeTimers();
  useNavigation.setState({
    mode: 'app', activeInstanceId: null, transitionDirection: null,
    settingsOpen: false, backCallback: null, peek: null,
    lastGestureMs: Date.now(),
  });
  useNavigation.getState().initApps();
});
afterEach(() => vi.useRealTimers());

describe('checkIdle', () => {
  it('dismisses an idle overlay after OVERLAY_IDLE_MS', () => {
    useNavigation.getState().showGrid();
    vi.advanceTimersByTime(OVERLAY_IDLE_MS + 1000);
    checkIdle();
    expect(useNavigation.getState().mode).toBe('app');
  });

  it('leaves a fresh overlay alone', () => {
    useNavigation.getState().showGrid();
    vi.advanceTimersByTime(OVERLAY_IDLE_MS / 2);
    checkIdle();
    expect(useNavigation.getState().mode).toBe('grid');
  });

  it('returns to the first app after HOME_IDLE_MS', () => {
    const home = useNavigation.getState().appOrder[0];
    useNavigation.getState().swipeToNext();
    useNavigation.getState().finishTransition();
    vi.advanceTimersByTime(HOME_IDLE_MS + 1000);
    checkIdle();
    // switchToApp enters transitioning toward home
    expect(useNavigation.getState().activeAppId).toBe(home);
  });

  it('never fires home-return mid-transition', () => {
    useNavigation.getState().swipeToNext(); // mode: transitioning
    vi.advanceTimersByTime(HOME_IDLE_MS + 1000);
    checkIdle();
    // must not stack a second transition on top of an in-flight one
    expect(useNavigation.getState().mode).toBe('transitioning');
  });

  it('an idle settings overlay is dismissed and chains the home clock', () => {
    useNavigation.getState().showSettings();
    vi.advanceTimersByTime(OVERLAY_IDLE_MS + 1000);
    checkIdle();
    expect(useNavigation.getState().settingsOpen).toBe(false);
    // hideSettings stamped lastGestureMs — home return NOT immediate
    vi.advanceTimersByTime(1000);
    checkIdle();
    expect(useNavigation.getState().mode).toBe('app');
  });
});
