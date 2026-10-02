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
  const hours = [10, 60, 80, 90, 70, 30, 20].map((p, i) => hour(14 + i, p));
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
    expect(text(container)).toContain('Overcast, rain from 15:00');
    expect(text(container)).toContain('H 16°   L 8°');
    // Six hourly columns: now plus five, labelled from the model's own hours.
    for (const label of ['Now', '15', '16', '17', '18', '19']) expect(screen.getByText(label)).toBeTruthy();
    expect(text(container)).not.toContain('20%'); // the seventh hour is not drawn
    expect(text(container)).not.toContain('Offline');
  });

  it('says how old a stale screen is instead of passing it off as live', () => {
    const { container } = render(<FieldsWeather {...base} offline />);
    expect(screen.getByText('Offline since 13:40')).toBeTruthy();
    expect(text(container)).not.toContain('H 16°'); // the chip takes the detail slot
    expect(screen.getByRole('img').getAttribute('aria-label')).toContain('Offline since 13:40');
  });

  it('asks for a place when nothing is configured', () => {
    render(<FieldsWeather {...base} model={null} unconfigured />);
    expect(screen.getByText('Then the forecast appears here')).toBeTruthy();
    expect(screen.getByRole('img').getAttribute('aria-label')).toContain('not set up');
  });

  it('says the forecast cannot be reached when there is no cache', () => {
    render(<FieldsWeather {...base} model={null} offline />);
    expect(screen.getByText('Can’t reach the forecast. Trying again.')).toBeTruthy();
  });

  it('draws only the header while the first fetch is in flight', () => {
    const { container } = render(<FieldsWeather {...base} model={null} />);
    expect(text(container)).toBe('Montréal');
  });

  it('marks the current page among the pager dots', () => {
    const { container } = render(<FieldsWeather {...base} page={2} />);
    const dots = [...container.querySelectorAll('circle')].filter((c) => c.getAttribute('r') === '6');
    expect(dots).toHaveLength(6);
    expect(dots.map((d) => d.getAttribute('opacity'))).toEqual(['0.35', '0.35', '1', '0.35', '0.35', '0.35']);
  });
});
