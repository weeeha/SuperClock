// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import FieldsWeather, { type FieldsWeatherProps } from './FieldsWeather';
import type { HourSample, WeatherModel } from './weather-utils';

afterEach(cleanup);

function hour(h: number, precipProb: number): HourSample {
  return { hour: h, temp: 14, apparent: 13, humidity: 60, precipProb, windSpeed: 10, windGust: 20, uv: 2, code: 3, isDay: true };
}

const MODEL: WeatherModel = (() => {
  const hours = [10, 60, 80, 90, 70, 30, 20].map((p, i) => ({ ...hour(14 + i, p), code: p >= 50 ? 61 : 3 }));
  return { current: { ...hours[0], windDir: 200 }, today: { high: 16, low: 8, sunriseMin: 400, sunsetMin: 1100 }, hours };
})();

const base: FieldsWeatherProps = {
  model: MODEL, label: 'Montréal', offline: false, updatedAt: new Date(2026, 9, 1, 13, 40),
  unconfigured: false, page: 0, pageCount: 6,
};

const text = (c: HTMLElement) => c.textContent ?? '';

describe('FieldsWeather', () => {
  it('draws the live screen from the model, nothing invented', () => {
    const { container } = render(<FieldsWeather {...base} />);
    expect(text(container)).toContain('14°');
    expect(screen.getByText('Overcast')).toBeTruthy();
    expect(screen.getByText('Rain from 15:00')).toBeTruthy();
    expect(text(container)).toContain('H:16°   L:8°');
    // Six hourly columns: now plus five, labelled from the model's own hours.
    for (const label of ['Now', '15', '16', '17', '18', '19']) expect(screen.getByText(label)).toBeTruthy();
    // Rain chance only where it matters (30% and up), and only for the six.
    for (const p of ['60%', '80%', '90%', '70%', '30%']) expect(screen.getByText(p)).toBeTruthy();
    expect(text(container)).not.toContain('10%');
    expect(text(container)).not.toContain('20%');
    expect(text(container)).not.toContain('Offline');
  });

  it('draws a multicolour mark for the hero and for every hour', () => {
    const { container } = render(<FieldsWeather {...base} />);
    const marks = [...container.querySelectorAll('g[data-mark]')].map((g) => g.getAttribute('data-mark'));
    // Hero + six hours, each from the model's own condition codes.
    expect(marks).toEqual(['cloud', 'cloud', 'rain', 'rain', 'rain', 'rain', 'cloud']);
    // Rain marks carry their own drop colour, not the ink.
    expect(container.innerHTML).toContain('var(--fields-weather-drop)');
  });

  it('says how old a stale screen is instead of passing it off as live', () => {
    render(<FieldsWeather {...base} offline />);
    expect(screen.getByText('Offline since 13:40')).toBeTruthy();
    expect(screen.queryByText('Rain from 15:00')).toBeNull(); // the chip takes the change slot
    expect(screen.getByRole('img').getAttribute('aria-label')).toContain('Offline since 13:40');
  });

  it('asks for a place when nothing is configured', () => {
    render(<FieldsWeather {...base} model={null} label="" unconfigured />);
    expect(screen.getByText('Pick a place')).toBeTruthy();
    expect(screen.getByText('Set a location in the admin')).toBeTruthy();
    expect(screen.getByRole('img').getAttribute('aria-label')).toContain('not set up');
  });

  it('says the forecast cannot be reached when there is no cache', () => {
    render(<FieldsWeather {...base} model={null} offline />);
    expect(screen.getByText('No weather yet')).toBeTruthy();
    expect(screen.getByText('Can’t reach the forecast')).toBeTruthy();
  });

  it('draws only the header while the first fetch is in flight', () => {
    const { container } = render(<FieldsWeather {...base} model={null} />);
    expect(text(container)).toBe('Montréal');
  });

  it('shortens the panel when no hour reaches the rain-chance threshold', () => {
    const dry = { ...MODEL, hours: MODEL.hours.map((h) => ({ ...h, precipProb: 5, code: 3 })) };
    const { container } = render(<FieldsWeather {...base} model={dry} />);
    const panel = [...container.querySelectorAll('rect')].find((r) => r.getAttribute('y') === '672');
    expect(panel?.getAttribute('height')).toBe('212');
    expect(container.textContent).not.toContain('%');
  });

  it('marks the current page among the pager dots', () => {
    const { container } = render(<FieldsWeather {...base} page={2} />);
    const dots = [...container.querySelectorAll('circle')].filter((c) => c.getAttribute('r') === '6');
    expect(dots).toHaveLength(6);
    expect(dots.map((d) => d.getAttribute('opacity'))).toEqual(['0.35', '0.35', '1', '0.35', '0.35', '0.35']);
  });
});
