// Navigation store invariants — especially the transition contract that
// SwipeContainer depends on: every action that sets mode:'transitioning'
// must also change the render key (activeInstanceId ?? activeAppId), or
// AnimatePresence never fires onExitComplete and the kiosk wedges with all
// gestures dead (they gate on mode === 'app' | 'grid').

import { describe, it, expect, beforeEach } from 'vitest';
import { useNavigation } from './navigation';
import '../apps'; // registers apps so initApps() has ids

function renderKey(): string {
  const s = useNavigation.getState();
  return s.activeInstanceId ?? s.activeAppId;
}

beforeEach(() => {
  useNavigation.setState({
    mode: 'app',
    activeInstanceId: null,
    transitionDirection: null,
    settingsOpen: false,
    backCallback: null,
    peek: null,
  });
  useNavigation.getState().initApps();
});

describe('transition contract: mode "transitioning" implies a key change', () => {
  it('switchToInstance between two instances of the SAME app changes the key', () => {
    const nav = useNavigation.getState();
    nav.switchToInstance('inst-a', 'clock');
    const keyA = renderKey();
    expect(useNavigation.getState().mode).toBe('transitioning');

    useNavigation.getState().finishTransition();
    useNavigation.getState().switchToInstance('inst-b', 'clock');
    expect(renderKey()).not.toBe(keyA); // same appId — key must still change
    expect(useNavigation.getState().mode).toBe('transitioning');
  });

  it('switchToInstance with the current instance id is a no-op (no wedge)', () => {
    useNavigation.getState().switchToInstance('inst-a', 'clock');
    useNavigation.getState().finishTransition();
    expect(useNavigation.getState().mode).toBe('app');

    useNavigation.getState().switchToInstance('inst-a', 'clock');
    expect(useNavigation.getState().mode).toBe('app'); // did not enter transitioning
  });

  it('switchToApp to the already-active app never enters transitioning', () => {
    const { activeAppId } = useNavigation.getState();
    useNavigation.getState().switchToApp(activeAppId);
    expect(useNavigation.getState().mode).toBe('app');
  });

  it('swipeToNext / swipeToPrev always change the key', () => {
    const before = renderKey();
    useNavigation.getState().swipeToNext();
    expect(renderKey()).not.toBe(before);
    expect(useNavigation.getState().mode).toBe('transitioning');

    useNavigation.getState().finishTransition();
    const mid = renderKey();
    useNavigation.getState().swipeToPrev();
    expect(renderKey()).not.toBe(mid);
  });

  it('finishTransition returns to app mode and clears direction', () => {
    useNavigation.getState().swipeToNext();
    useNavigation.getState().finishTransition();
    const s = useNavigation.getState();
    expect(s.mode).toBe('app');
    expect(s.transitionDirection).toBeNull();
  });
});

describe('quick-settings overlay + back gesture (spec 2026-07-24)', () => {
  it('showSettings opens only from app mode', () => {
    useNavigation.getState().showSettings();
    expect(useNavigation.getState().settingsOpen).toBe(true);
  });

  it('settings never touches mode — cannot strand transitioning', () => {
    useNavigation.getState().showSettings();
    expect(useNavigation.getState().mode).toBe('app');
    useNavigation.getState().hideSettings();
    expect(useNavigation.getState().mode).toBe('app');
  });

  it('settings and grid are mutually exclusive', () => {
    useNavigation.getState().showSettings();
    useNavigation.getState().showGrid();
    // grid opening closes settings
    expect(useNavigation.getState().settingsOpen).toBe(false);
    expect(useNavigation.getState().mode).toBe('grid');

    // and settings refuses to open over the grid
    useNavigation.getState().showSettings();
    expect(useNavigation.getState().settingsOpen).toBe(false);
  });

  it('showSettings is a no-op while transitioning', () => {
    useNavigation.getState().swipeToNext(); // mode: transitioning
    useNavigation.getState().showSettings();
    expect(useNavigation.getState().settingsOpen).toBe(false);
  });

  it('goBack with no registered callback is a strict no-op', () => {
    const before = useNavigation.getState();
    useNavigation.getState().goBack();
    expect(useNavigation.getState().mode).toBe(before.mode);
    expect(useNavigation.getState().activeAppId).toBe(before.activeAppId);
  });

  it('goBack invokes the registered callback', () => {
    let called = 0;
    useNavigation.getState().setBackCallback(() => { called += 1; });
    useNavigation.getState().goBack();
    expect(called).toBe(1);
    useNavigation.getState().setBackCallback(null);
  });

  it('overlay actions stamp lastGestureMs', () => {
    useNavigation.setState({ lastGestureMs: 0 });
    useNavigation.getState().showSettings();
    expect(useNavigation.getState().lastGestureMs).toBeGreaterThan(0);
  });
});
