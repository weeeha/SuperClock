// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import RoundList from './RoundList';

// Vitest runs without globals, so testing-library cannot self-register its
// afterEach cleanup — every jsdom test file does this explicitly.
afterEach(cleanup);

const ITEMS = ['alpha', 'beta', 'gamma'];

describe('RoundList', () => {
  it('renders one row per item', () => {
    render(
      <RoundList items={ITEMS} empty={<p>why empty</p>} renderItem={(s) => <span>row {s}</span>} />,
    );
    for (const s of ITEMS) expect(screen.getByText(`row ${s}`)).toBeTruthy();
    expect(screen.queryByText('why empty')).toBeNull();
  });

  it('fires onSelect with the item and its index', () => {
    const onSelect = vi.fn();
    render(
      <RoundList
        items={ITEMS}
        onSelect={onSelect}
        empty={<p>e</p>}
        renderItem={(s) => <span>row {s}</span>}
      />,
    );
    fireEvent.click(screen.getByText('row beta'));
    expect(onSelect).toHaveBeenCalledWith('beta', 1);
  });

  // `empty` is a required prop precisely so an empty list has to say why.
  it('renders the required empty state for []', () => {
    render(<RoundList items={[]} empty={<p>why empty</p>} renderItem={() => null} />);
    expect(screen.getByText('why empty')).toBeTruthy();
  });

  it('keeps the header outside the scroll area', () => {
    render(
      <RoundList
        items={ITEMS}
        header={<h1>the header</h1>}
        empty={<p>e</p>}
        renderItem={(s) => <span>row {s}</span>}
      />,
    );
    const scroller = screen.getByText('row alpha').closest('[data-roundlist-scroll]');
    expect(scroller).toBeTruthy();
    expect(scroller!.contains(screen.getByText('the header'))).toBe(false);
  });

  it('gives every row the configured height so touch targets stay reliable', () => {
    render(
      <RoundList
        items={ITEMS}
        itemHeight={120}
        empty={<p>e</p>}
        renderItem={(s) => <span>row {s}</span>}
      />,
    );
    const row = screen.getByText('row alpha').closest('div');
    expect(row).toBeTruthy();
    expect((row as HTMLElement).style.height).toBe('120px');
  });
});
