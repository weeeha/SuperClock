import { useEffect, useState } from 'react';
import type { PushOutcome } from '../../shared/types';

// Honest save-vs-push reporting (spec: never a false success). `applied`
// self-dismisses; the two amber states persist until the next outcome — a
// queued or suppressed push must stay visible. Visibility resets via the
// adjust-state-during-render pattern (setState inside an effect trips the
// hooks-v7 cascading-render rule); the effect only owns the hide timer.
export function PushOutcomeChip({ outcome }: { outcome: PushOutcome | null }) {
  const [seen, setSeen] = useState<{ outcome: PushOutcome | null; hidden: boolean }>({
    outcome: null,
    hidden: false,
  });
  if (outcome !== seen.outcome) {
    setSeen({ outcome, hidden: false });
  }

  useEffect(() => {
    if (outcome !== 'applied') return;
    const t = setTimeout(() => setSeen((s) => ({ ...s, hidden: true })), 2000);
    return () => clearTimeout(t);
  }, [outcome]);

  if (!outcome || seen.hidden) return null;

  if (outcome === 'applied') {
    return (
      <span className="rounded-full px-2 py-0.5 text-xs text-[hsl(var(--success))]">pushed</span>
    );
  }
  const copy = outcome === 'queued' ? 'saved · queued' : 'saved here · not pushed (dev)';
  return (
    <span className="rounded-full bg-[hsl(var(--warning)/0.1)] px-2 py-0.5 text-xs text-[hsl(var(--warning-foreground))]">
      {copy}
    </span>
  );
}
