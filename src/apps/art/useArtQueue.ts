import { useState, useEffect, useCallback } from 'react';
import type { Artwork } from './types';
import { fetchRandomBatch } from './sources';

type Status = 'loading' | 'ready' | 'error';

interface ArtQueueState {
  current: Artwork | null;
  status: Status;
}

const MIN_QUEUE = 3;
const REFILL_COOLDOWN_MS = 4000;
const ERROR_RETRY_MS = 8000;

/* -------------------- Shared module-level queue --------------------
 * Lives outside React so it survives StrictMode double-mount (otherwise
 * two competing per-instance queues race, the cancelled mount fills one
 * and the live mount never sees an item). Also lets the queue persist if
 * the user briefly swipes away and back. */

const queue: Artwork[] = [];
let currentFill: Promise<void> | null = null;
let lastFillAttempt = 0;

function preload(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('preload failed'));
    img.src = url;
  });
}

/** Fetches a batch and preloads its images. Resolves as soon as the FIRST
 *  preload lands, so Time-To-First-Image isn't gated on the slowest in batch.
 *  Remaining preloads keep pushing into the queue in the background. */
async function doFill(): Promise<void> {
  const batch = await fetchRandomBatch();
  await new Promise<void>((resolve) => {
    if (batch.length === 0) {
      resolve();
      return;
    }
    let pending = batch.length;
    let firstResolved = false;
    batch.forEach((art) => {
      preload(art.imageUrl)
        .then(() => {
          queue.push(art);
          if (!firstResolved) {
            firstResolved = true;
            resolve();
          }
        })
        .catch(() => {
          /* drop — preload failed, skip this item */
        })
        .finally(() => {
          pending--;
          if (pending === 0 && !firstResolved) resolve();
        });
    });
  });
}

/** Throttled, deduped fetch. Concurrent callers share the same in-flight
 *  promise so a fill kicked off by a dying StrictMode mount still notifies
 *  the live mount. */
function fillBatch(): Promise<void> {
  if (currentFill) return currentFill;
  if (queue.length >= MIN_QUEUE) return Promise.resolve();
  const now = Date.now();
  if (now - lastFillAttempt < REFILL_COOLDOWN_MS) return Promise.resolve();
  lastFillAttempt = now;
  currentFill = doFill().finally(() => {
    currentFill = null;
  });
  return currentFill;
}

/* -------------------- React hook -------------------- */

/**
 * Returns the currently-displayed artwork and pumps the queue on a timer
 * while `active` is true. Status is derived (not stored) so we can't end
 * up in an "items ready but UI stuck loading" mismatch.
 */
export function useArtQueue({
  active,
  intervalMs,
}: {
  active: boolean;
  intervalMs: number;
}): ArtQueueState {
  const [current, setCurrent] = useState<Artwork | null>(null);
  const [errored, setErrored] = useState(false);

  const advance = useCallback(() => {
    if (queue.length > 0) {
      setCurrent(queue.shift()!);
      setErrored(false);
    }
    if (queue.length < MIN_QUEUE) {
      fillBatch().catch(() => {
        if (queue.length === 0) setErrored(true);
      });
    }
  }, []);

  // Initial seed — fires whenever the app becomes active and we have no current.
  useEffect(() => {
    if (!active) return;
    if (current) return;
    let cancelled = false;
    (async () => {
      try {
        await fillBatch();
      } catch {
        if (!cancelled && queue.length === 0) setErrored(true);
        return;
      }
      if (cancelled) return;
      if (queue.length > 0) {
        setCurrent(queue.shift()!);
        setErrored(false);
      } else {
        setErrored(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [active, current]);

  // Retry loop while in the empty-error state.
  useEffect(() => {
    if (!active || !errored) return;
    const id = setInterval(() => {
      fillBatch()
        .then(() => {
          if (queue.length > 0) {
            setCurrent(queue.shift()!);
            setErrored(false);
          }
        })
        .catch(() => {
          /* keep retrying */
        });
    }, ERROR_RETRY_MS);
    return () => clearInterval(id);
  }, [active, errored]);

  // Rotation timer.
  useEffect(() => {
    if (!active || !current) return;
    const id = setInterval(advance, intervalMs);
    return () => clearInterval(id);
  }, [active, current, intervalMs, advance]);

  const status: Status = current ? 'ready' : errored ? 'error' : 'loading';
  return { current, status };
}
