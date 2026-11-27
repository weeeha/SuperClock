// @vitest-environment jsdom
// The 2026-11-01 review: setPointerCapture threw NotFoundError on a pointer the
// browser no longer tracks, which aborted pointerdown before the drag began.
// Capture is an optimisation; the drag has to start without it.
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import TimerDial from './TimerDial';

afterEach(cleanup);

describe('TimerDial', () => {
  it('still drags when setPointerCapture throws', () => {
    const onChange = vi.fn();
    const { container } = render(<TimerDial durationMs={0} onChange={onChange} />);
    const band = container.querySelector('circle[data-gesture="claim"]') as SVGCircleElement;
    band.setPointerCapture = () => {
      throw new DOMException('No active pointer with the given id is found.', 'NotFoundError');
    };
    // jsdom boxes are 0x0, so the centre is (0, 0): straight up is 12, straight right is 3.
    expect(() => fireEvent.pointerDown(band, { pointerId: 7, clientX: 0, clientY: -100 })).not.toThrow();
    fireEvent.pointerMove(band, { pointerId: 7, clientX: 100, clientY: 0 });
    expect(onChange).toHaveBeenLastCalledWith(15 * 60_000);
  });
});
