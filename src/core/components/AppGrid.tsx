import { useRef } from 'react';
import { motion } from 'framer-motion';
import { useGesture } from '@use-gesture/react';
import { useNavigation } from '../navigation';

// App face thumbnails from Figma designs — mapped to app IDs
// Layout follows the Figma grid (489:30357): columns of face previews
const appFaces: { id: string; src: string }[] = [
  { id: 'calendar',      src: '/66e1444195d1e33bc606b22d835d1fd622557dcb.png' },
  { id: 'clock',          src: '/0c1961af226ba211646b2b33306bc15147b1b2b6.png' },
  { id: 'quote',          src: '/39cdd10bd458b184830ee8dd78d5f01d99bda902.png' },
  { id: 'weather',        src: '/fca3f89707c8636082807a2351c8b645ca702a00.png' },
  { id: 'clock',          src: '/943f75df27e1332321d3108a522e892298894540.png' },
  { id: 'fireplace',      src: '/81f94dfb595df1aee5f553535d4406d7aab01b7d.png' },
  { id: 'photo-frame',    src: '/a748a5a0305756791110c2732c1757e377a9b831.png' },
  { id: 'fitness',        src: '/33bd4aa08e3af76c3ace9a1565cd7275abf34678.png' },
  { id: 'habits',         src: '/cc876a16834c102930f72c63c69d462b84dbc32e.png' },
  { id: 'clock',          src: '/8e5d0338383404692c1d0484623940d0d4399f2d.png' },
  { id: 'clock',          src: '/cee377e32880ba501c02f449690367b8028ab4cf.png' },
  { id: 'time-tracking',  src: '/690ef2a4d2142a144f030f7a4f4bc796609d3518.png' },
  { id: 'github',          src: '/github-thumb.svg' },
  { id: 'claude-usage',    src: '/claude-usage-thumb.svg' },
];

// Arrange into columns matching Figma layout (489:30357)
// The Figma design has 7 columns with varying heights
const columns = [
  [appFaces[0]],                          // Earth/Calendar (single)
  [appFaces[1], appFaces[2]],             // Quote, Space
  [appFaces[3], appFaces[4], appFaces[5]], // Calendar, Productivity, Github
  [appFaces[6], appFaces[7], appFaces[8], appFaces[9]], // Watchface, Abstract, Weather, Space
  [appFaces[10], appFaces[11], appFaces[0]], // Clock, Relax, Gym
  [appFaces[1], appFaces[2]],             // Photo, Habits
  [appFaces[3], appFaces[12], appFaces[13]], // Magnetic Liquid, GitHub, Claude Usage
];

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
