// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, act, fireEvent } from '@testing-library/react';
import AlertLayer from './AlertLayer';
import { registerAlertView, type AlertViewProps } from './views';
import { useAlerts, type RingingAlert } from './alert-store';

const chime = vi.hoisted(() => ({ start: vi.fn(), stop: vi.fn() }));
vi.mock('./chime', async (orig) => ({
  ...(await orig<typeof import('./chime')>()),
  createChime: () => chime,
}));
const config = vi.hoisted(() => ({ deviceId: 'superclock-fast' }));
vi.mock('../device-config', () => ({ useDeviceConfig: () => config }));

function TestView({ phase, dismiss }: AlertViewProps) {
  return (
    <button type="button" onClick={dismiss}>
      test view {phase}
    </button>
  );
}
registerAlertView('test-app', TestView);

const ringing = (over: Partial<RingingAlert> = {}): RingingAlert => ({
  id: 'r', appId: 'test-app', firesAt: 0, firedAt: 0, sound: true, settled: false, payload: {}, ...over,
});

beforeEach(() => {
  chime.start.mockClear();
  chime.stop.mockClear();
  config.deviceId = 'superclock-fast';
  useAlerts.setState({ scheduled: [], ringing: null });
});
afterEach(cleanup);

describe('AlertLayer', () => {
  it('renders nothing when nothing rings', () => {
    const { container } = render(<AlertLayer />);
    expect(container.firstChild).toBeNull();
  });

  it('renders the registered view with its phase, above everything', () => {
    useAlerts.setState({ ringing: ringing() });
    const { container } = render(<AlertLayer />);
    expect(screen.getByText('test view ringing')).toBeTruthy();
    expect((container.firstChild as HTMLElement).className).toContain('z-[9500]');
  });

  it('dismisses through the view', () => {
    useAlerts.setState({ ringing: ringing() });
    render(<AlertLayer />);
    fireEvent.click(screen.getByText('test view ringing'));
    expect(useAlerts.getState().ringing).toBeNull();
  });

  it('falls back to a dismissable view for an app that registered none', () => {
    useAlerts.setState({ ringing: ringing({ appId: 'nobody' }) });
    render(<AlertLayer />);
    fireEvent.click(screen.getByText('Tap to dismiss'));
    expect(useAlerts.getState().ringing).toBeNull();
  });

  it('chimes only while ringing, with sound, on a clock with audio', () => {
    useAlerts.setState({ ringing: ringing() });
    render(<AlertLayer />);
    expect(chime.start).toHaveBeenCalledTimes(1);
    act(() => useAlerts.getState().settle());
    expect(chime.stop).toHaveBeenCalledTimes(1);
    expect(screen.getByText('test view settled')).toBeTruthy();
  });

  it('never chimes without sound or without the audio flag', () => {
    useAlerts.setState({ ringing: ringing({ sound: false }) });
    const { unmount } = render(<AlertLayer />);
    unmount();
    config.deviceId = 'superclock-small';
    useAlerts.setState({ ringing: ringing() });
    render(<AlertLayer />);
    expect(chime.start).not.toHaveBeenCalled();
  });
});
