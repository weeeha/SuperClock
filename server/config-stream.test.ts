import { describe, expect, it, vi } from 'vitest';
import { fleetEvents } from './fleet-store';

describe('fleet change events', () => {
  it('exposes an emitter the SSE route can subscribe to', () => {
    expect(typeof fleetEvents.on).toBe('function');
  });

  it('delivers a device-changed payload to a listener', () => {
    const seen = vi.fn();
    fleetEvents.on('device-changed', seen);
    fleetEvents.emit('device-changed', { deviceId: 'superclock-fast' });
    fleetEvents.off('device-changed', seen);
    expect(seen).toHaveBeenCalledWith({ deviceId: 'superclock-fast' });
  });

  it('stops delivering after a listener is removed', () => {
    const seen = vi.fn();
    fleetEvents.on('device-changed', seen);
    fleetEvents.off('device-changed', seen);
    fleetEvents.emit('device-changed', { deviceId: 'superclock-fast' });
    expect(seen).not.toHaveBeenCalled();
  });

  // A kiosk holds this stream open for weeks. If the route ever forgets to
  // unsubscribe on close, listeners accumulate one per reconnect until node
  // warns and then leaks; keeping the cap explicit makes that visible.
  it('does not silently accumulate listeners', () => {
    expect(fleetEvents.listenerCount('device-changed')).toBe(0);
  });
});
