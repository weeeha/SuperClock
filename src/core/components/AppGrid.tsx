import { useRef } from 'react';
import { motion } from 'framer-motion';
import { useGesture } from '@use-gesture/react';
import { useNavigation } from '../navigation';
import { columns } from './app-grid-tiles';

export default function AppGrid() {
  const { switchToApp } = useNavigation();
  const panRef = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  useGesture(
    {
      onDrag: ({ offset: [ox, oy] }) => {
        if (containerRef.current) {
          // Clamp so the grid can't be flung fully off-screen with no way
          // back (short of closing and reopening the overlay).
          const x = Math.max(-window.innerWidth, Math.min(window.innerWidth, ox));
          const y = Math.max(-window.innerHeight / 2, Math.min(window.innerHeight / 2, oy));
          containerRef.current.style.transform = `translate(${x}px, ${y}px)`;
          panRef.current = { x, y };
        }
      },
    },
    {
      target: containerRef,
      drag: { from: () => [panRef.current.x, panRef.current.y] },
    },
  );

  // No mode check here: App.tsx mounts this only in grid mode, and an early
  // null return would defeat AnimatePresence's exit animation.

  const tileSize = 'min(22vw, 22vh)';
  const gap = 'min(1.5vw, 1.5vh)';

  return (
    <motion.div
      className="absolute inset-0 z-50 overflow-hidden bg-black"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.3 }}
    >
      <div className="absolute inset-0 flex items-center justify-center">
        {/* Pannable grid of face thumbnails */}
        <div
          ref={containerRef}
          className="flex items-center cursor-grab active:cursor-grabbing touch-none"
          style={{ gap }}
        >
          {columns.map((col, ci) => (
            <div key={ci} className="flex flex-col" style={{ gap }}>
              {col.map((face, fi) => (
                <button
                  key={`${ci}-${fi}`}
                  onClick={() => switchToApp(face.id)}
                  className="rounded-full overflow-hidden shrink-0 active:scale-95 transition-transform"
                  style={{ width: tileSize, height: tileSize }}
                >
                  <img
                    src={face.src}
                    alt=""
                    className="w-full h-full object-cover pointer-events-none"
                    draggable={false}
                  />
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
