// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import type { FaceComponent } from './face-components';
import FloralClock from './FloralClock';
import ProductivityClock from './ProductivityClock';
import ComplicationsLight from './ComplicationsLight';
import ComplicationsDark from './ComplicationsDark';
import AnalogClock from './AnalogClock';

afterEach(cleanup);

// isActive false: no timer starts, the hands render once at mount time.
function shadows(Face: FaceComponent, faceConfig?: Record<string, unknown>) {
  const { container } = render(<Face isActive={false} faceConfig={faceConfig} />);
  return {
    cast: container.querySelectorAll('[data-hand-shadow="cast"]').length,
    soft: container.querySelectorAll('[data-hand-shadow="soft"]').length,
    lines: container.querySelectorAll('line').length,
    container,
  };
}

const CAST_BY_DEFAULT: Array<[string, FaceComponent]> = [
  ['floral', FloralClock],
  ['productivity', ProductivityClock],
  ['complications-light', ComplicationsLight],
];
const NONE_BY_DEFAULT: Array<[string, FaceComponent]> = [
  ['analog', AnalogClock],
  ['complications-dark', ComplicationsDark],
];

describe('hand shadow wiring', () => {
  for (const [id, Face] of CAST_BY_DEFAULT) {
    it(`${id}: three cast shadows unconfigured, none when told none, one soft filter when told soft`, () => {
      expect(shadows(Face).cast).toBe(3);
      cleanup();
      expect(shadows(Face, { handShadow: 'none' }).cast).toBe(0);
      cleanup();
      const soft = shadows(Face, { handShadow: 'soft' });
      expect(soft.cast).toBe(0);
      expect(soft.soft).toBe(1);
    });
  }

  for (const [id, Face] of NONE_BY_DEFAULT) {
    it(`${id}: no shadow unconfigured, three cast when told cast`, () => {
      const rest = shadows(Face);
      expect(rest.cast + rest.soft).toBe(0);
      cleanup();
      expect(shadows(Face, { handShadow: 'cast' }).cast).toBe(3);
    });
  }

  it('productivity and analog cast two shadows when the second hand is off', () => {
    expect(shadows(ProductivityClock, { showSeconds: false }).cast).toBe(2);
    cleanup();
    expect(shadows(AnalogClock, { showSeconds: false, handShadow: 'cast' }).cast).toBe(2);
  });

  it('complications light no longer carries its own per-line blur', () => {
    const { container } = shadows(ComplicationsLight);
    expect(container.querySelector('filter#cl-shadow')).toBeNull();
    expect(container.querySelectorAll('line[filter]')).toHaveLength(0);
  });

  it('an invalid saved value falls back to the default, not to a crash', () => {
    expect(shadows(FloralClock, { handShadow: 'glow' }).cast).toBe(3);
  });
});
