import { useState, useEffect, useMemo, useRef } from 'react';
import type { AppProps } from '../../core/types';
import { photoFrameAppSchema } from '../../shared/schemas/app.photo-frame';

const FADE_MS = 500;
/** How long the list fetch may run before the screen admits it is loading.
 *  Below this the device's own Express answers and a tell would only flash. */
const LOADING_TELL_MS = 600;

type FetchStatus = 'loading' | 'ok' | 'error';

// Slideshow position. Module scope because SwipeContainer unmounts the app on
// swipe-away: component state restarts the show at photo 0 on every visit, so
// at the default 8s interval only the first photo or two is ever seen.
let slideCursor = 0;

/** Photo Frame — full-bleed slideshow. The bezel is the frame on the round
 *  devices, so the image fills the surface and the subject stays centred.
 *  Transitions cross-dissolve between two layers; the screen never passes
 *  through black between slides. */
export default function PhotoFrameApp({ isActive, config }: AppProps) {
  const cfg = useMemo(() => {
    const parsed = photoFrameAppSchema.safeParse(config ?? {});
    return parsed.success ? parsed.data : photoFrameAppSchema.parse({});
  }, [config]);

  const intervalMs = Math.min(300, Math.max(3, cfg.intervalSeconds)) * 1000;
  // 'cut' → instant swap; 'fade' (and 'zoom', not implemented — falls back to
  // fade) → cross-dissolve.
  const usesFade = cfg.transition !== 'cut';

  const [photos, setPhotos] = useState<string[]>([]);
  const [status, setStatus] = useState<FetchStatus>('loading');
  const [slowLoad, setSlowLoad] = useState(false);
  // The slide on screen, and the one dissolving in over it.
  const [current, setCurrent] = useState(slideCursor);
  const [incoming, setIncoming] = useState<number | null>(null);

  // The advance timer reads the list without re-subscribing when a refetch
  // returns an equal-length array (a new array identity every 60s would
  // otherwise restart the interval and stall the show).
  const photosRef = useRef<string[]>([]);

  // Fetch the photo list; while active, refresh every 60s (also the retry).
  useEffect(() => {
    if (!isActive) return;
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch('/api/photos');
        if (!res.ok) throw new Error(`photos ${res.status}`);
        const data = (await res.json()) as string[];
        if (!cancelled) {
          photosRef.current = data;
          setPhotos(data);
          setStatus('ok');
        }
      } catch {
        // This request is same-origin: it is served by this device's own
        // Express, so a failure means the local server, not the internet.
        if (!cancelled) setStatus('error');
      }
    }
    void load();
    const id = window.setInterval(() => void load(), 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [isActive]);

  // Hold the loading tell back until the fetch is visibly slow. Reset lives in
  // the cleanup so leaving 'loading' clears it without a state write on render.
  useEffect(() => {
    if (status !== 'loading') return;
    const id = window.setTimeout(() => setSlowLoad(true), LOADING_TELL_MS);
    return () => {
      window.clearTimeout(id);
      setSlowLoad(false);
    };
  }, [status]);

  // Advance the slideshow. Only meaningful with 2+ photos.
  useEffect(() => {
    if (!isActive || photos.length < 2) return;
    let cancelled = false;
    let swapTimer: number | undefined;

    const id = window.setInterval(() => {
      const list = photosRef.current;
      if (list.length < 2) return;
      const next = (slideCursor + 1) % list.length;

      const begin = () => {
        if (cancelled) return;
        slideCursor = next;
        if (!usesFade) {
          setCurrent(next);
          return;
        }
        setIncoming(next);
        swapTimer = window.setTimeout(() => {
          if (cancelled) return;
          // Batched: the base layer takes the (now decoded and cached) next
          // image in the same commit that removes the layer above it.
          setCurrent(next);
          setIncoming(null);
        }, FADE_MS);
      };

      // Decode before dissolving: a multi-megabyte JPEG can still be
      // rasterising on a Pi 4 when the fade would otherwise have started.
      const img = new Image();
      img.src = `/photos/${list[next]}`;
      void img.decode().then(begin, begin);
    }, intervalMs);

    return () => {
      cancelled = true;
      window.clearInterval(id);
      if (swapTimer !== undefined) window.clearTimeout(swapTimer);
    };
  }, [isActive, photos.length, intervalMs, usesFade]);

  if (photos.length === 0) {
    return (
      <div className="theme-fade flex h-full w-full flex-col items-center justify-center gap-[2%] bg-(--face-bg) px-[12%] text-center">
        {status === 'error' ? (
          <>
            <p className="theme-fade text-[3vmin] text-(--face-ink)">Photo list unavailable</p>
            <p className="theme-fade text-[2.2vmin] text-(--face-ink-muted)">
              this clock's own server did not answer · retrying
            </p>
          </>
        ) : status === 'ok' ? (
          <>
            <p className="theme-fade text-[3vmin] text-(--face-ink)">No photos on this clock</p>
            <p className="theme-fade text-[2.2vmin] text-(--face-ink-muted)">
              pictures are read from public/photos/ and ship with the build
            </p>
          </>
        ) : slowLoad ? (
          <p className="theme-fade text-[2.2vmin] text-(--face-ink-muted)">Loading photos</p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="theme-fade relative h-full w-full overflow-hidden bg-(--face-bg)">
      <img
        src={`/photos/${photos[current % photos.length]}`}
        alt=""
        className="absolute inset-0 h-full w-full object-cover"
        draggable={false}
      />
      {incoming !== null && (
        <img
          key={photos[incoming % photos.length]}
          src={`/photos/${photos[incoming % photos.length]}`}
          alt=""
          className="dissolve-in absolute inset-0 h-full w-full object-cover"
          style={{ animationDuration: `${FADE_MS}ms` }}
          draggable={false}
        />
      )}
      {/* Honest tell over the photo. On an opaque plate, because the ink role
          alone cannot be trusted to read against an arbitrary image. */}
      {status === 'error' && (
        <p className="theme-fade pointer-events-none absolute bottom-[7.5%] left-1/2 -translate-x-1/2 rounded-full bg-(--face-plate) px-[2.5%] py-[0.8%] text-[2.2vmin] text-(--face-ink-muted)">
          photo list unavailable · retrying
        </p>
      )}
    </div>
  );
}
