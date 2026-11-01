// @vitest-environment jsdom
// The idle return reads lastGestureMs. Swipes and the overlays write it, but
// a person tapping through a timer or a workout for five minutes never swipes,
// and on 2026-11-01 that pulled a running Timer back to the clock. Every
// pointerdown is activity.
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useRef } from 'react';
import { useNavigation } from '../navigation';
import { useAppGestures } from './useGestures';
import '../../apps';

beforeEach(() => {
  useNavigation.setState({ lastGestureMs: 0 });
});

describe('useAppGestures', () => {
  it('a plain tap counts as activity for the idle return', () => {
    renderHook(() => {
      const ref = useRef<HTMLDivElement | null>(document.createElement('div'));
      useAppGestures(ref);
    });
    expect(useNavigation.getState().lastGestureMs).toBe(0);

    window.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 1, bubbles: true }));
    expect(useNavigation.getState().lastGestureMs).toBeGreaterThan(0);
  });
});
