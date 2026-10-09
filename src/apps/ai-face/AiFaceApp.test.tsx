// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

const night = vi.hoisted(() => ({ value: false }));
vi.mock('../../core/apply-settings', () => ({ useIsNight: () => night.value }));
const frame = vi.hoisted(() => ({ props: null as null | Record<string, unknown> }));
vi.mock('./AvatarFrame', () => ({
  default: (p: Record<string, unknown>) => { frame.props = p; return null; },
}));

import AiFaceApp from './AiFaceApp';

afterEach(() => { cleanup(); night.value = false; });

describe('AiFaceApp', () => {
  it('defaults to Wheatley in demo with the Demo tell', () => {
    render(<AiFaceApp isActive />);
    expect((frame.props!.design as { id: string }).id).toBe('core-eyes/wheatley');
    expect(screen.getByText('Demo')).toBeTruthy();
  });

  it('holds a fixed state with no Demo tell', () => {
    render(<AiFaceApp isActive config={{ source: 'fixed', activity: 'thinking', expression: 'curious' }} />);
    expect(frame.props!.state).toEqual({ activity: 'thinking', expression: 'curious' });
    expect(screen.queryByText('Demo')).toBeNull();
  });

  it('sleeps at night', () => {
    night.value = true;
    render(<AiFaceApp isActive config={{ source: 'fixed', activity: 'thinking', expression: 'curious' }} />);
    expect(frame.props!.state).toEqual({ activity: 'sleeping', expression: 'curious' });
  });

  it('falls back to defaults on a design this build does not know', () => {
    render(<AiFaceApp isActive config={{ design: 'oracle/oracle' }} />);
    expect((frame.props!.design as { id: string }).id).toBe('core-eyes/wheatley');
  });

  it('passes isActive through and shows the time only when asked', () => {
    render(<AiFaceApp isActive={false} config={{ showTime: true }} />);
    expect(frame.props!.active).toBe(false);
    expect(screen.getByTestId('ai-face-time')).toBeTruthy();
  });

  // The surface is bg-black in both modes, so its text must read a role that
  // does not flip with the mode (--sheet-ink), never --face-ink, which is
  // black in day mode.
  it('paints the time label and the Demo tell with the mode-stable ink', () => {
    render(<AiFaceApp isActive config={{ showTime: true }} />);
    for (const el of [screen.getByTestId('ai-face-time'), screen.getByText('Demo')]) {
      expect(el.className).toContain('--sheet-ink');
      expect(el.className).not.toContain('--face-ink');
    }
  });
});
