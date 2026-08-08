import { motion } from 'framer-motion';
import { useNavigation } from '../navigation';

// PATTERN STUB — anatomy only, no wired controls yet.
//
// This exists so the top-edge gesture has a destination and the allocation is
// testable end to end. The control set is deliberately inert: neither Apple nor
// Google documents a third-party quick-settings surface (watchOS summons it
// with the side button, Wear's shade has no public API), so the real contents
// are a design decision, not a port. Samsung's shade is the only visual
// precedent. Spec lands with the pattern section; the shape below — round
// toggles on an arc plus a bottom dismiss pill — is the Samsung anatomy.

const SLOTS = ['Night', 'Bright', 'Theme'];

export default function QuickSettingsShade() {
  const dismissOverlay = useNavigation((s) => s.dismissOverlay);

  return (
    <motion.div
      className="fixed inset-0 z-[9500] flex flex-col items-center justify-center bg-black/95"
      initial={{ y: '-100%' }}
      animate={{ y: 0 }}
      exit={{ y: '-100%' }}
      transition={{ type: 'spring', stiffness: 300, damping: 32 }}
    >
      <p className="text-[3.2vmin] uppercase tracking-[0.3em] text-white/50">
        Quick settings
      </p>

      <div className="mt-[6vmin] flex items-center gap-[4vmin]">
        {SLOTS.map((label) => (
          <div key={label} className="flex flex-col items-center gap-[1.6vmin]">
            <div className="h-[14vmin] w-[14vmin] rounded-full border border-white/15 bg-white/5" />
            <span className="text-[2.4vmin] text-white/35">{label}</span>
          </div>
        ))}
      </div>

      <p className="mt-[5vmin] text-[2.2vmin] text-white/25">controls not wired yet</p>

      <button
        type="button"
        onClick={dismissOverlay}
        className="absolute bottom-[10%] rounded-full bg-white/10 px-[7vmin] py-[2.2vmin] text-[2.8vmin] text-white/80"
      >
        Close
      </button>
    </motion.div>
  );
}
