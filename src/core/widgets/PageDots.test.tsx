// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import PageDots from './PageDots';

describe('PageDots', () => {
  it('draws one dot per page and marks the current one', () => {
    const { container } = render(<PageDots count={4} index={2} />);
    const dots = container.querySelectorAll('[data-dot]');
    expect(dots).toHaveLength(4);
    expect(dots[2].getAttribute('data-current')).toBe('true');
    expect(dots[0].getAttribute('data-current')).toBe('false');
  });

  it('draws nothing for a single page', () => {
    const { container } = render(<PageDots count={1} index={0} />);
    expect(container.querySelector('[data-dot]')).toBeNull();
  });

  it('is decorative: hidden from assistive tech and from touch', () => {
    const { container } = render(<PageDots count={2} index={0} />);
    const root = container.firstElementChild!;
    expect(root.getAttribute('aria-hidden')).toBe('true');
    expect(root.className).toContain('pointer-events-none');
  });
});
