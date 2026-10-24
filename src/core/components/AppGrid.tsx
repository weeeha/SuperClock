import { motion } from 'framer-motion';
import { useNavigation } from '../navigation';
import { gridTiles } from './app-grid-layout';

// One round tile per registered app, laid out inside the disc; the shape and
// its reasons live in app-grid-layout.ts, pinned by AppGrid.test.tsx.
//
// The earlier grid copied a Figma board: seven columns of mock face art
// (a family photo, a "30°" forecast, "Tuesday 17 April"), wider than the
// disc and pannable, so the outer tiles and their labels fell off the panel.

const TILE = '16.67vmin';
const GAP = '1.3vmin';

export default function AppGrid() {
  const { switchToApp } = useNavigation();
  const rows = gridTiles();

  // No mode check here: App.tsx mounts this only in grid mode, and an early
  // null return would defeat AnimatePresence's exit animation.
  return (
    <motion.div
      className="absolute inset-0 z-50 overflow-hidden bg-black"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.3 }}
    >
      <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ gap: GAP }}>
        {rows.map((row, ri) => (
          <div key={ri} className="flex justify-center" style={{ gap: GAP }}>
            {row.map((tile) => (
              <button
                key={tile.id}
                type="button"
                aria-label={tile.id}
                onClick={() => switchToApp(tile.id)}
                className="shrink-0 overflow-hidden rounded-full transition-transform active:scale-95"
                style={{ width: TILE, height: TILE }}
              >
                <img
                  src={tile.src}
                  alt=""
                  className="pointer-events-none h-full w-full object-cover"
                  draggable={false}
                />
              </button>
            ))}
          </div>
        ))}
      </div>
    </motion.div>
  );
}
