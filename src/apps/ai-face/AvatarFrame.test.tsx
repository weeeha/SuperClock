// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, act, fireEvent } from '@testing-library/react';
import AvatarFrame, { ATTACH_TIMEOUT_MS, UNMOUNT_AFTER_MS } from './AvatarFrame';
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
});
