// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, act, fireEvent } from '@testing-library/react';
import AlertLayer from './AlertLayer';
import { registerLeadView, type LeadViewProps } from './views';
import { useAlerts, type RingingAlert, type ScheduledAlert } from './alert-store';

const lease = vi.hoisted(() => ({ acquire: vi.fn(), release: vi.fn() }));
vi.mock('../brightness-lease', () => ({
  acquireBrightnessLease: lease.acquire,
  releaseBrightnessLease: lease.release,
}));
const wake = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock('./wake', () => ({ requestPanelWake: wake.request }));
vi.mock('./chime', async (orig) => ({
  ...(await orig<typeof import('./chime')>()),
  createChime: () => ({ start() {}, stop() {} }),
}));
vi.mock('../device-config', () => ({ useDeviceConfig: () => ({ deviceId: 'superclock-small' }) }));

function Lead({ alert, hide }: LeadViewProps) {
  return (
    <button type="button" onClick={hide}>
      lead for {alert.id}
    </button>
  );
}
registerLeadView('lead-app', Lead);

const ringing = (over: Partial<RingingAlert> = {}): RingingAlert => ({
  id: 'r', appId: 'nobody', firesAt: 1000, firedAt: 1000, sound: false, settled: false, payload: {}, ...over,
});
const leadAlert: ScheduledAlert = { id: 'l', appId: 'lead-app', firesAt: 50_000, sound: false, payload: {}, leadMs: 10_000, ringMs: 900_000 };

beforeEach(() => {
  vi.useFakeTimers();
  lease.acquire.mockClear();
  lease.release.mockClear();
  wake.request.mockClear();
  useAlerts.setState({ scheduled: [], ringing: null, leading: null, leadHidden: false });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('AlertLayer: brightness, wake, lead', () => {
  it('holds the brightness lease for a bright alert, renews it, and releases it on settle', () => {
    useAlerts.setState({ ringing: ringing({ bright: true }) });
    render(<AlertLayer />);
    expect(lease.acquire).toHaveBeenCalledTimes(1);
    act(() => vi.advanceTimersByTime(60_000));
    expect(lease.acquire).toHaveBeenCalledTimes(2);
    act(() => useAlerts.getState().settle());
    expect(lease.release).toHaveBeenCalledTimes(1);
  });

  it('releases the lease on dismiss too', () => {
    useAlerts.setState({ ringing: ringing({ bright: true }) });
    render(<AlertLayer />);
    act(() => useAlerts.getState().dismiss());
    expect(lease.release).toHaveBeenCalledTimes(1);
  });

  it('never takes the lease for an alert that is not bright', () => {
    useAlerts.setState({ ringing: ringing() });
    render(<AlertLayer />);
    expect(lease.acquire).not.toHaveBeenCalled();
  });

  it('asks to wake the panel once per ring, until its settle time plus a minute', () => {
    useAlerts.setState({ ringing: ringing({ ringMs: 900_000 }) });
    const { rerender } = render(<AlertLayer />);
    rerender(<AlertLayer />);
    expect(wake.request).toHaveBeenCalledTimes(1);
    expect(wake.request).toHaveBeenCalledWith(1000 + 900_000 + 60_000);
  });

  it('shows the lead view while leading, wakes the panel, and hides it on tap', () => {
    useAlerts.setState({ scheduled: [leadAlert], leading: 'l' });
    render(<AlertLayer />);
    expect(wake.request).toHaveBeenCalledWith(50_000 + 900_000 + 60_000);
    fireEvent.click(screen.getByText('lead for l'));
    expect(useAlerts.getState().leadHidden).toBe(true);
    expect(screen.queryByText('lead for l')).toBeNull();
  });

  it('shows nothing for a lead whose app registered no lead view', () => {
    useAlerts.setState({ scheduled: [{ ...leadAlert, appId: 'timer' }], leading: 'l' });
    const { container } = render(<AlertLayer />);
    expect(container.firstChild).toBeNull();
  });
});
