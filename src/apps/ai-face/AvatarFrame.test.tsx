// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, act, fireEvent } from '@testing-library/react';
import AvatarFrame, { ATTACH_TIMEOUT_MS, RETRY_AFTER_MS, SLEEP_SETTLE_MS, UNMOUNT_AFTER_MS } from './AvatarFrame';
import { findDesign } from '../../shared/ai-face-designs';
import type { AvatarController, FamilyAdapter } from './adapters/types';

const design = findDesign('core-eyes/wheatley')!;
const state = { activity: 'thinking', expression: 'curious' } as const;

function fakeAdapter(ready = true) {
  const controller: AvatarController = {
    apply: vi.fn(), setPaused: vi.fn(), setMuted: vi.fn(),
    sample: vi.fn(() => ({ frame: 0, idle: false })), destroy: vi.fn(),
  };
  const adapter: FamilyAdapter = {
    pageUrl: () => '/avatars/test.html',
    kioskCss: '.page-nav{display:none}',
    activityMap: {} as FamilyAdapter['activityMap'],
    expressionMap: {} as FamilyAdapter['expressionMap'],
    attach: vi.fn(() => (ready ? controller : null)),
  };
  return { adapter, controller };
}

function loadIframe() {
  const iframe = document.querySelector('iframe')!;
  fireEvent.load(iframe);
  return iframe;
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('AvatarFrame', () => {
  it('renders a pointer-transparent iframe for the design page', () => {
    const { adapter } = fakeAdapter();
    render(<AvatarFrame design={design} state={state} active adapter={adapter} />);
    const iframe = document.querySelector('iframe')!;
    expect(iframe.getAttribute('src')).toBe('/avatars/test.html');
    expect(iframe.style.pointerEvents).toBe('none');
  });

  it('injects the kiosk stylesheet, attaches, applies the state and runs while active', () => {
    const { adapter, controller } = fakeAdapter();
    render(<AvatarFrame design={design} state={state} active adapter={adapter} />);
    const iframe = loadIframe();
    act(() => { vi.advanceTimersByTime(100); });
    expect(iframe.contentDocument!.head.innerHTML).toContain('.page-nav{display:none}');
    expect(controller.apply).toHaveBeenCalledWith(state);
    expect(controller.setPaused).toHaveBeenLastCalledWith(false);
  });

  it('shows the honest unavailable tell when the page never becomes ready', () => {
    const { adapter } = fakeAdapter(false);
    render(<AvatarFrame design={design} state={state} active adapter={adapter} />);
    loadIframe();
    act(() => { vi.advanceTimersByTime(ATTACH_TIMEOUT_MS + 100); });
    expect(screen.getByText('Face unavailable')).toBeTruthy();
  });

  it('pauses at once when inactive, keeps the iframe through a quick return, unmounts after the grace period', () => {
    const { adapter, controller } = fakeAdapter();
    const { rerender } = render(<AvatarFrame design={design} state={state} active adapter={adapter} />);
    const first = loadIframe();
    act(() => { vi.advanceTimersByTime(100); });

    rerender(<AvatarFrame design={design} state={state} active={false} adapter={adapter} />);
    expect(controller.setPaused).toHaveBeenLastCalledWith(true);
    act(() => { vi.advanceTimersByTime(UNMOUNT_AFTER_MS - 1000); });
    rerender(<AvatarFrame design={design} state={state} active adapter={adapter} />);
    expect(document.querySelector('iframe')).toBe(first);

    rerender(<AvatarFrame design={design} state={state} active={false} adapter={adapter} />);
    act(() => { vi.advanceTimersByTime(UNMOUNT_AFTER_MS + 1000); });
    expect(document.querySelector('iframe')).toBeNull();
    expect(controller.destroy).toHaveBeenCalled();

    rerender(<AvatarFrame design={design} state={state} active adapter={adapter} />);
    expect(document.querySelector('iframe')).not.toBeNull();
  });

  it('stops its guard interval while inactive and leaves no timers after unmount', () => {
    const { adapter } = fakeAdapter();
    const { unmount } = render(<AvatarFrame design={design} state={state} active adapter={adapter} />);
    loadIframe();
    act(() => { vi.advanceTimersByTime(100); });
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('treats a hidden document as an idle sample, never as a slow face', () => {
    const { adapter, controller } = fakeAdapter();
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    render(<AvatarFrame design={design} state={state} active adapter={adapter} />);
    loadIframe();
    act(() => { vi.advanceTimersByTime(100); });
    act(() => { vi.advanceTimersByTime(60_000); });
    expect(screen.queryByText('Paused to keep the clock cool')).toBeNull();
    expect(controller.setPaused).not.toHaveBeenLastCalledWith(true);
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
  });

  it('pauses with the cool-down tell when the page stays slow through both steps', () => {
    const { adapter, controller } = fakeAdapter();
    let frame = 0;
    controller.sample = vi.fn(() => ({ frame: (frame += 5), idle: false }));
    render(<AvatarFrame design={design} state={state} active adapter={adapter} />);
    loadIframe();
    // React batches state set inside act, so let the attach commit before the
    // guard interval (which starts on 'ready') is asked to run.
    act(() => { vi.advanceTimersByTime(100); });
    act(() => { vi.advanceTimersByTime(40_000); });
    expect(screen.getByText('Paused to keep the clock cool')).toBeTruthy();
    expect(controller.setPaused).toHaveBeenLastCalledWith(true);
  });

  it('paints its tells with the mode-stable ink on the always-black surface', () => {
    const { adapter } = fakeAdapter(false);
    render(<AvatarFrame design={design} state={state} active adapter={adapter} />);
    loadIframe();
    act(() => { vi.advanceTimersByTime(ATTACH_TIMEOUT_MS + 100); });
    const tell = screen.getByText('Face unavailable');
    expect(tell.className).toContain('--sheet-ink');
    expect(tell.className).not.toContain('--face-ink');
  });

  it('does not throw on unmount when the controller destroy throws', () => {
    const { adapter, controller } = fakeAdapter();
    controller.destroy = vi.fn(() => { throw new Error('Framebuffer incomplete'); });
    const { unmount } = render(<AvatarFrame design={design} state={state} active adapter={adapter} />);
    loadIframe();
    act(() => { vi.advanceTimersByTime(100); });
    expect(() => unmount()).not.toThrow();
    expect(controller.destroy).toHaveBeenCalled();
  });

  it('shows the unavailable tell when the page throws on apply', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { adapter, controller } = fakeAdapter();
    controller.apply = vi.fn(() => { throw new Error('boom'); });
    render(<AvatarFrame design={design} state={state} active adapter={adapter} />);
    loadIframe();
    act(() => { vi.advanceTimersByTime(100); });
    expect(screen.getByText('Face unavailable')).toBeTruthy();
    warn.mockRestore();
  });

  it('shows the unavailable tell when attach throws on every call', () => {
    const { adapter } = fakeAdapter();
    adapter.attach = vi.fn(() => { throw new Error('page not ready'); });
    render(<AvatarFrame design={design} state={state} active adapter={adapter} />);
    loadIframe();
    act(() => { vi.advanceTimersByTime(ATTACH_TIMEOUT_MS + 100); });
    expect(screen.getByText('Face unavailable')).toBeTruthy();
  });

  it('tears the page down when it becomes unavailable: no iframe, controller destroyed', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { adapter, controller } = fakeAdapter();
    controller.apply = vi.fn(() => { throw new Error('boom'); });
    render(<AvatarFrame design={design} state={state} active adapter={adapter} />);
    loadIframe();
    act(() => { vi.advanceTimersByTime(100); });
    expect(screen.getByText('Face unavailable')).toBeTruthy();
    expect(document.querySelector('iframe')).toBeNull();
    expect(controller.destroy).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('removes the iframe when the attach times out', () => {
    const { adapter } = fakeAdapter(false);
    render(<AvatarFrame design={design} state={state} active adapter={adapter} />);
    loadIframe();
    act(() => { vi.advanceTimersByTime(ATTACH_TIMEOUT_MS + 100); });
    expect(document.querySelector('iframe')).toBeNull();
  });

  it('shows the tell after the attach timeout even when load never fires', () => {
    const { adapter } = fakeAdapter();
    render(<AvatarFrame design={design} state={state} active adapter={adapter} />);
    act(() => { vi.advanceTimersByTime(ATTACH_TIMEOUT_MS + 100); });
    expect(screen.getByText('Face unavailable')).toBeTruthy();
    expect(adapter.attach).not.toHaveBeenCalled();
  });

  describe('retry', () => {
    function slowAdapter() {
      const made = fakeAdapter();
      let frame = 0;
      made.controller.sample = vi.fn(() => ({ frame: (frame += 5), idle: false }));
      return made;
    }
    function reachPaused(adapter: FamilyAdapter) {
      const view = render(<AvatarFrame design={design} state={state} active adapter={adapter} />);
      const first = loadIframe();
      act(() => { vi.advanceTimersByTime(100); });
      act(() => { vi.advanceTimersByTime(40_000); });
      expect(screen.getByText('Paused to keep the clock cool')).toBeTruthy();
      return { ...view, first };
    }

    it('mounts a fresh face after the cool-down while active, with a fresh guard', () => {
      const { adapter } = slowAdapter();
      const { first } = reachPaused(adapter);
      act(() => { vi.advanceTimersByTime(RETRY_AFTER_MS - 1000); });
      expect(document.querySelector('iframe')).toBe(first);
      act(() => { vi.advanceTimersByTime(2000); });
      const next = document.querySelector('iframe');
      expect(next).not.toBeNull();
      expect(next).not.toBe(first);
      expect(screen.queryByText('Paused to keep the clock cool')).toBeNull();
    });

    it('retries an unavailable face with a new attach', () => {
      const { adapter } = fakeAdapter(false);
      render(<AvatarFrame design={design} state={state} active adapter={adapter} />);
      loadIframe();
      act(() => { vi.advanceTimersByTime(ATTACH_TIMEOUT_MS + 100); });
      expect(document.querySelector('iframe')).toBeNull();
      act(() => { vi.advanceTimersByTime(RETRY_AFTER_MS + 1000); });
      expect(document.querySelector('iframe')).not.toBeNull();
      expect(screen.queryByText('Face unavailable')).toBeNull();
      loadIframe();
      act(() => { vi.advanceTimersByTime(100); });
      expect(adapter.attach).toHaveBeenCalled();
    });

    it('does not retry while inactive', () => {
      const { adapter } = slowAdapter();
      const { rerender } = reachPaused(adapter);
      rerender(<AvatarFrame design={design} state={state} active={false} adapter={adapter} />);
      act(() => { vi.advanceTimersByTime(RETRY_AFTER_MS + UNMOUNT_AFTER_MS); });
      expect(document.querySelector('iframe')).toBeNull();
      // A later return is a fresh mount, not a stale paused face.
      rerender(<AvatarFrame design={design} state={state} active adapter={adapter} />);
      expect(document.querySelector('iframe')).not.toBeNull();
      expect(screen.queryByText('Paused to keep the clock cool')).toBeNull();
    });
  });

  it('unpauses before it applies the state on reactivation', () => {
    const { adapter, controller } = fakeAdapter();
    const next = { activity: 'answering', expression: 'happy' } as const;
    const { rerender } = render(<AvatarFrame design={design} state={state} active adapter={adapter} />);
    loadIframe();
    act(() => { vi.advanceTimersByTime(100); });
    rerender(<AvatarFrame design={design} state={state} active={false} adapter={adapter} />);
    vi.mocked(controller.apply).mockClear();
    vi.mocked(controller.setPaused).mockClear();

    rerender(<AvatarFrame design={design} state={next} active adapter={adapter} />);
    const unpaused = vi.mocked(controller.setPaused).mock.calls.findIndex(([p]) => p === false);
    expect(unpaused).toBeGreaterThanOrEqual(0);
    const pauseOrder = vi.mocked(controller.setPaused).mock.invocationCallOrder[unpaused];
    const applyOrder = vi.mocked(controller.apply).mock.invocationCallOrder[0];
    expect(controller.apply).toHaveBeenCalledWith(next);
    expect(pauseOrder).toBeLessThan(applyOrder);
  });

  it('pauses a sleeping page once its pose has settled, and unpauses on another activity', () => {
    const { adapter, controller } = fakeAdapter();
    const sleeping = { activity: 'sleeping', expression: 'neutral' } as const;
    const { rerender } = render(<AvatarFrame design={design} state={sleeping} active adapter={adapter} />);
    loadIframe();
    act(() => { vi.advanceTimersByTime(100); });
    expect(controller.setPaused).toHaveBeenLastCalledWith(false);

    act(() => { vi.advanceTimersByTime(SLEEP_SETTLE_MS - 500); });
    expect(controller.setPaused).toHaveBeenLastCalledWith(false);
    act(() => { vi.advanceTimersByTime(1000); });
    expect(controller.setPaused).toHaveBeenLastCalledWith(true);

    rerender(<AvatarFrame design={design} state={{ activity: 'thinking', expression: 'neutral' }} active adapter={adapter} />);
    expect(controller.setPaused).toHaveBeenLastCalledWith(false);
    act(() => { vi.advanceTimersByTime(SLEEP_SETTLE_MS * 3); });
    expect(controller.setPaused).toHaveBeenLastCalledWith(false);
  });
});
