// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, act } from '@testing-library/react';
import { useApplySettings } from './apply-settings';
import { useAlerts } from './alerts/alert-store';

vi.mock('./device-config', () => ({
  useDeviceConfig: () => ({
    deviceId: 'superclock-fast',
    enabledApps: [],
    instances: [],
    playlist: { items: [], rotationSeconds: null },
    settings: { theme: 'system', accent: '#ff6b35', night: { start: '00:00', end: '23:59', brightness: 30 } },
  }),
}));

function Probe() {
  useApplySettings();
  return null;
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  useAlerts.setState({ scheduled: [], ringing: null, leading: null, leadHidden: false });
});

describe('useApplySettings brightness', () => {
  it('dims at night, ramps the dimming out over a lead window, and restores it after', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 2, 3, 0, 0));
    render(<Probe />);
    const root = document.documentElement;
    expect(root.style.filter).toBe('brightness(0.3)');
    expect(root.style.transition).toBe('filter 1s ease');
    act(() =>
      useAlerts.setState({
        scheduled: [{ id: 'alarm:a', appId: 'alarm', firesAt: Date.now() + 600_000, sound: false, payload: {}, leadMs: 600_000 }],
        leading: 'alarm:a',
      }),
    );
    expect(root.style.transition).toBe('filter 600000ms linear');
    expect(root.style.filter).toBe('');
    act(() => useAlerts.setState({ scheduled: [], leading: null }));
    expect(root.style.transition).toBe('filter 1s ease');
    expect(root.style.filter).toBe('brightness(0.3)');
  });
});
