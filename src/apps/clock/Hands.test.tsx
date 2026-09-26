// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { Hands, CAST, SOFT, type HandSpec } from './Hands';

// Vitest runs without globals, so testing-library cannot self-register its
// afterEach cleanup; every jsdom test file does this explicitly.
afterEach(cleanup);

const HANDS: HandSpec[] = [
  { deg: 90, tip: 235, tail: 20, width: 24, stroke: 'white' },
  { deg: 180, tip: 335, tail: 25, width: 15, stroke: 'white' },
  { deg: 270, tip: 355, tail: 65, width: 5, stroke: 'gold', transition: 'transform 0.2s' },
];

function draw(shadow: 'none' | 'cast' | 'soft', hands: HandSpec[] = HANDS) {
  const { container } = render(
    <svg viewBox="0 0 1000 1000">
      <Hands id="t" shadow={shadow} hands={hands} />
    </svg>,
  );
  return container.querySelector('svg')!;
}

describe('Hands', () => {
  it('none: one line per hand, rotated about the centre, and nothing else', () => {
    const svg = draw('none');
    const lines = [...svg.querySelectorAll('line')];
    expect(lines).toHaveLength(3);
    expect(svg.querySelectorAll('[data-hand-shadow]')).toHaveLength(0);
    expect(lines[0].getAttribute('x1')).toBe('500');
    expect(lines[0].getAttribute('y1')).toBe('520'); // centre + tail
    expect(lines[0].getAttribute('y2')).toBe('265'); // centre - tip
    expect(lines[0].getAttribute('stroke-width')).toBe('24');
    expect(lines[0].style.transform).toBe('rotate(90deg)');
    expect(lines[0].style.transformOrigin).toBe('500px 500px');
    expect(lines[2].style.transition).toBe('transform 0.2s');
  });

  it('cast: a translated copy under each hand, offset outside the rotation, interleaved so a shadow falls on the hands beneath', () => {
    const svg = draw('cast');
    const groups = [...svg.querySelectorAll('[data-hand-shadow="cast"]')];
    expect(groups).toHaveLength(3);
    const lines = [...svg.querySelectorAll('line')];
    expect(lines).toHaveLength(6);
    groups.forEach((g, i) => {
      expect(g.getAttribute('transform')).toBe(`translate(${CAST.dx} ${CAST.dy})`);
      expect(g.getAttribute('opacity')).toBe(String(CAST.alpha));
      const shadow = g.querySelector('line')!;
      const hand = lines[2 * i + 1];
      expect(lines[2 * i], 'shadow precedes its hand').toBe(shadow);
      expect(shadow.getAttribute('class')).toBe('stroke-(--face-shadow)');
      expect(shadow.hasAttribute('stroke')).toBe(false);
      for (const a of ['x1', 'y1', 'x2', 'y2', 'stroke-width']) {
        expect(shadow.getAttribute(a), a).toBe(hand.getAttribute(a));
      }
      expect(shadow.style.transform).toBe(hand.style.transform);
      expect(shadow.style.transform).not.toContain('translate');
      expect(shadow.style.transition).toBe(hand.style.transition);
    });
  });

  it('soft: one filter over every hand, on a fixed full-face region, with the decided numbers', () => {
    const svg = draw('soft');
    expect(svg.querySelectorAll('[data-hand-shadow="cast"]')).toHaveLength(0);
    const group = svg.querySelector('[data-hand-shadow="soft"]')!;
    expect(group.getAttribute('filter')).toBe('url(#t-hand-shadow)');
    expect(group.querySelectorAll('line')).toHaveLength(3);
    expect(svg.querySelectorAll('line')).toHaveLength(3);
    const filter = svg.querySelector('filter#t-hand-shadow')!;
    expect(filter.getAttribute('filterUnits')).toBe('userSpaceOnUse');
    expect([
      filter.getAttribute('x'),
      filter.getAttribute('y'),
      filter.getAttribute('width'),
      filter.getAttribute('height'),
    ]).toEqual(['0', '0', '1000', '1000']);
    const drop = filter.querySelector('feDropShadow')!;
    expect(drop.getAttribute('dx')).toBe(String(SOFT.dx));
    expect(drop.getAttribute('dy')).toBe(String(SOFT.dy));
    expect(drop.getAttribute('stdDeviation')).toBe(String(SOFT.blur));
    expect(drop.getAttribute('flood-opacity')).toBe(String(SOFT.alpha));
    expect(drop.getAttribute('style')).toContain('var(--face-shadow)');
  });

  it('a bordered hand draws its core on top and casts one shadow, from the outer stroke', () => {
    const bordered: HandSpec[] = [
      { deg: 0, tip: 190, tail: 35, width: 44, stroke: 'white', core: { width: 32, stroke: '#111' } },
    ];
    const plain = draw('none', bordered);
    const [outer, core] = [...plain.querySelectorAll('line')];
    expect(outer.getAttribute('stroke-width')).toBe('44');
    expect(core.getAttribute('stroke-width')).toBe('32');
    expect(core.getAttribute('stroke')).toBe('#111');
    cleanup();
    const cast = draw('cast', bordered);
    const shadows = cast.querySelectorAll('[data-hand-shadow="cast"] line');
    expect(shadows).toHaveLength(1);
    expect(shadows[0].getAttribute('stroke-width')).toBe('44');
    expect(cast.querySelectorAll('line')).toHaveLength(3);
  });

  it('the numbers are the decision', () => {
    expect(CAST).toEqual({ dx: 8, dy: 10, alpha: 0.32 });
    expect(SOFT).toEqual({ dx: 5, dy: 7, blur: 9, alpha: 0.38 });
  });
});
