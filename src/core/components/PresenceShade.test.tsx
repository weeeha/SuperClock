// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, act } from '@testing-library/react';
import PresenceShade from './PresenceShade';
import { useAlerts } from '../alerts/alert-store';

vi.mock('../radar', () => ({
  useRadar: () => ({ available: true, present: false, lastPresentAt: new Date(Date.now() - 3_600_000).toISOString() }),
}));
vi.mock('../device-config', () => ({
  useDeviceConfig: () => ({ settings: { presence: { enabled: true, absentAfterMin: 1 } } }),
}));

afterEach(() => {
  cleanup();
  useAlerts.setState({ scheduled: [], ringing: null });
});

describe('PresenceShade', () => {
  it('shades an empty room, and steps aside while an alert rings', () => {
    const { container } = render(<PresenceShade />);
    expect((container.firstChild as HTMLElement).className).toContain('opacity-100');
    act(() =>
      useAlerts.setState({
        ringing: { id: 'r', appId: 'timer', firesAt: 0, firedAt: 0, sound: false, settled: false, payload: {} },
      }),
    );
    expect(container.firstChild).toBeNull();
  });
});
