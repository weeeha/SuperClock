import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigation } from '../navigation';

// Every shell surface now lives in an invisible 15% edge zone, which makes the
// system unlearnable on its own. When a vertical swipe lands in the interior of
// an app that wants none, we bounce the rim that WOULD have served it — swiping
// down points at quick settings (top), swiping up points at the grid (bottom).
// This is the discoverability half of the gesture allocation; without it the
// edge zones are a secret.

const DURATION_MS = 900;

/** Arc along the rim spanning the 90-degree sector centred on 12 or 6 o'clock. */
const ARC = {
  top: 'M 155 155 A 488 488 0 0 1 845 155',
  bottom: 'M 845 845 A 488 488 0 0 1 155 845',
};

export default function EdgeHint() {
  const edgeHint = useNavigation((s) => s.edgeHint);
  const clearEdgeHint = useNavigation((s) => s.clearEdgeHint);

  useEffect(() => {
    if (!edgeHint) return;
    const t = setTimeout(clearEdgeHint, DURATION_MS);
    return () => clearTimeout(t);
    // Keyed on id so a repeat hint restarts the timer rather than inheriting
    // the tail of the previous one.
  }, [edgeHint?.id, edgeHint, clearEdgeHint]);

  return (
    <AnimatePresence>
      {edgeHint && (
        <motion.svg
          key={edgeHint.id}
          viewBox="0 0 1000 1000"
          preserveAspectRatio="xMidYMid meet"
          className="pointer-events-none fixed inset-0 z-[8000] h-full w-full"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          <motion.path
            d={ARC[edgeHint.edge]}
            fill="none"
            // Not --color-accent: the hint has to read on Minimalismo's white
            // face as well as on black ones, and orange-on-white fails badly.
            // --face-ink flips with the theme, so contrast holds both ways.
            stroke="var(--face-ink)"
            strokeWidth={10}
            strokeLinecap="round"
            // The rubber band: springs inward off the rim, then settles back.
            initial={{ pathLength: 0.15, opacity: 0 }}
            animate={{
              pathLength: [0.15, 1, 1],
              opacity: [0, 0.9, 0],
              y: edgeHint.edge === 'top' ? [0, 26, 0] : [0, -26, 0],
            }}
            transition={{ duration: DURATION_MS / 1000, times: [0, 0.35, 1], ease: 'easeOut' }}
          />
        </motion.svg>
      )}
    </AnimatePresence>
  );
}
