// @vitest-environment jsdom
// A face set by config is where the clock starts, not a lock. fastclock's
// Rally instance pins faceId through the playlist, and on 2026-11-01 the
// vertical swipe did nothing there because the app dropped its callback
// whenever a face was configured. Now the configured face is the starting
// point of the swipe cycle, a new configured face resets the cycle to it,
// and a remount (swipe away and back) lands on it again.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, cleanup, act } from '@testing-library/react';
import { useNavigation } from '../../core/navigation';
import ClockApp from './ClockApp';
import { startIndexFor } from './face-cycle';
import { FACE_COMPONENTS, SWIPE_CYCLE_ORDER } from './face-components';

beforeEach(() => {
  useNavigation.setState({ verticalSwipeCallback: null });
});
afterEach(cleanup);

const faceOnGlass = (c: HTMLElement) => c.querySelector<HTMLElement>('[data-face]')?.dataset.face;

describe('startIndexFor', () => {
  it('maps a configured face to its place in the swipe cycle', () => {
    expect(startIndexFor('rally')).toBe(SWIPE_CYCLE_ORDER.indexOf(FACE_COMPONENTS.rally));
    expect(startIndexFor('analog')).toBe(SWIPE_CYCLE_ORDER.indexOf(FACE_COMPONENTS.analog));
  });

  it('starts the cycle at the first face when nothing or something unknown is configured', () => {
    expect(startIndexFor(undefined)).toBe(0);
    expect(startIndexFor('no-such-face')).toBe(0);
  });
});

describe('ClockApp with a configured face', () => {
  it('shows the configured face and still registers the vertical swipe', () => {
    const { container } = render(<ClockApp isActive config={{ faceId: 'analog' }} />);
    expect(faceOnGlass(container)).toBe('analog');
    expect(useNavigation.getState().verticalSwipeCallback).not.toBeNull();
  });

  it('cycles from the configured face on a swipe', () => {
    const { container } = render(<ClockApp isActive config={{ faceId: 'minimalismo' }} />);
    act(() => useNavigation.getState().verticalSwipeCallback?.('down'));
    expect(faceOnGlass(container)).toBe('analog');
    act(() => useNavigation.getState().verticalSwipeCallback?.('up'));
    expect(faceOnGlass(container)).toBe('minimalismo');
  });

  it('resets the cycle when the admin configures another face', () => {
    const { container, rerender } = render(<ClockApp isActive config={{ faceId: 'minimalismo' }} />);
    act(() => useNavigation.getState().verticalSwipeCallback?.('down'));
    expect(faceOnGlass(container)).toBe('analog');
    rerender(<ClockApp isActive config={{ faceId: 'square' }} />);
    expect(faceOnGlass(container)).toBe('square');
  });

  it('drops the callback while inactive, as every multi-view app does', () => {
    render(<ClockApp isActive={false} config={{ faceId: 'analog' }} />);
    expect(useNavigation.getState().verticalSwipeCallback).toBeNull();
  });
});
