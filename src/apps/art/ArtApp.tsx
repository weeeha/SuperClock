import { AnimatePresence, motion } from 'framer-motion';
import type { AppProps } from '../../core/types';
import type { Artwork } from './types';
import { useArtQueue } from './useArtQueue';
import './art.css';

/** Rotate every 30s while the app is active. Paused entirely when inactive. */
const INTERVAL_MS = 30_000;

/** Slow ambient museum wall — auto-rotating crops of paintings pulled from
 *  Art Institute of Chicago, The Met, and Cleveland Museum of Art. */
export default function ArtApp({ isActive }: AppProps) {
  const { current, status } = useArtQueue({ active: isActive, intervalMs: INTERVAL_MS });

  return (
    <div className="art-root">
      <AnimatePresence>
        {current && (
          <motion.div
            key={current.id}
            className="art-slide"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.2, ease: [0.4, 0, 0.2, 1] }}
          >
            <img src={current.imageUrl} alt="" className="art-image" draggable={false} />
            <div className="art-vignette" />
            <ArtLabel artwork={current} />
          </motion.div>
        )}
      </AnimatePresence>

      {status === 'loading' && !current && (
        <div className="art-loading">
          <div className="art-loading-arc" />
        </div>
      )}

      {status === 'error' && !current && (
        <div className="art-quiet">
          <p className="art-quiet-text">The wall is quiet.</p>
        </div>
      )}
    </div>
  );
}

/** Catalog-style label: italic serif title above a small-caps meta line.
 *  Fades in over the first second, holds, then dims to ~25% so it never
 *  blocks the painting but stays readable if you walk closer. */
function ArtLabel({ artwork }: { artwork: Artwork }) {
  const meta = [artwork.artist, artwork.date, artwork.museum].filter(Boolean).join(' · ');
  // Anchor owns the centering (CSS translateX(-50%)) so framer-motion's
  // transform animations on the inner div don't clobber it.
  return (
    <div className="art-label-anchor">
      <motion.div
        className="art-label"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: [0, 1, 1, 0.28], y: 0 }}
        transition={{
          opacity: { duration: 8, times: [0, 0.12, 0.55, 1], ease: 'easeOut' },
          y: { duration: 0.8, ease: 'easeOut' },
        }}
      >
        <p className="art-title">{artwork.title}</p>
        {meta && <p className="art-meta">{meta}</p>}
      </motion.div>
    </div>
  );
}
