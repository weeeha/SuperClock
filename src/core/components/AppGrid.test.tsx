import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { GRID_ROWS, gridTiles } from './app-grid-layout';
import { ALL_KIOSK_APP_IDS } from '../../shared/capabilities';
import { APP_ICONS } from '../../shared/app-icons';

describe('AppGrid layout', () => {
  it('shows every registered app exactly once, in swipe order', () => {
    const ids = gridTiles().flat().map((t) => t.id);
    expect(ids).toEqual([...ALL_KIOSK_APP_IDS]);
  });

  it('row shape sums to the app count, so nothing is dropped or doubled', () => {
    expect(GRID_ROWS.reduce((a, b) => a + b, 0)).toBe(ALL_KIOSK_APP_IDS.length);
  });

  it('every tile has art that exists in public/', () => {
    for (const tile of gridTiles().flat()) {
      expect(tile.src, `${tile.id} has no APP_ICONS entry`).toBe(APP_ICONS[tile.id]);
      expect(existsSync(join('public', tile.src)), `${tile.src} missing`).toBe(true);
    }
  });

  it('every tile sits inside the 1080 disc', () => {
    // Mirrors the CSS: tile 16.67 vmin (180 px), gap 1.3 vmin (14 px), rows
    // centred on the disc. The farthest point of each tile must be < 540 px
    // from the centre, or it is invisible on the round panels.
    const tile = 180;
    const gap = 14;
    const pitch = tile + gap;
    const rows = GRID_ROWS.length;
    GRID_ROWS.forEach((n, r) => {
      const cy = (r - (rows - 1) / 2) * pitch;
      for (let c = 0; c < n; c++) {
        const cx = (c - (n - 1) / 2) * pitch;
        const far = Math.hypot(cx, cy) + tile / 2;
        expect(far, `row ${r} col ${c} reaches ${far.toFixed(0)} px`).toBeLessThan(540);
      }
    });
  });
});
