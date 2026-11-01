// @vitest-environment jsdom
// Classic skin, no location: the honest tell is "not configured", not
// "offline". The hook already distinguishes the two (useWeather.unconfigured);
// the classic screen showed "weather offline" for both (2026-10-23 review,
// still on glass 2026-11-01).
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import WeatherApp from './WeatherApp';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('WeatherApp classic tells', () => {
  it('says what to do when no location is configured', async () => {
    vi.stubGlobal('fetch', () => Promise.reject(new Error('no network in tests')));
    render(<WeatherApp isActive config={{ location: '' }} />);
    expect(await screen.findByText('Set a location in the admin')).toBeTruthy();
    expect(screen.queryByText('weather offline')).toBeNull();
  });
});
