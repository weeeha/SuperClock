import { ALL_KIOSK_APP_IDS } from '../../shared/capabilities';
import { APP_ICONS } from '../../shared/app-icons';

// The grid's shape, kept apart from the component so react-refresh stays
// happy and AppGrid.test.tsx can pin it without rendering. One round tile per
// registered app, in swipe order, in rows that fit inside the 1080 disc:
// 3, 4, 4, 4, 3 at 180 px tiles puts the farthest tile edge 523 px from the
// centre, inside the 540 px radius. Art is APP_ICONS, the same one-per-app
// map the admin uses, so a tile can never show a screen its app does not draw.
export const GRID_ROWS = [3, 4, 4, 4, 3] as const;

export interface GridTile {
  id: string;
  src: string;
}

export function gridTiles(): GridTile[][] {
  const ids = [...ALL_KIOSK_APP_IDS];
  const rows: GridTile[][] = [];
  let i = 0;
  for (const n of GRID_ROWS) {
    rows.push(ids.slice(i, i + n).map((id) => ({ id, src: APP_ICONS[id] })));
    i += n;
  }
  return rows;
}
