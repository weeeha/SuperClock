import { useState, useEffect, useMemo } from 'react';
import type { AppProps } from '../../core/types';
import { photoFrameAppSchema } from '../../shared/schemas/app.photo-frame';

const FADE_MS = 500;

type FetchStatus = 'loading' | 'ok' | 'offline';

/** Photo Frame — based on Figma S15 design (489:21288). Circular photo with crossfade. */
export default function PhotoFrameApp({ isActive, config }: AppProps) {
  const cfg = useMemo(() => {
    const parsed = photoFrameAppSchema.safeParse(config ?? {});
    return parsed.success ? parsed.data : photoFrameAppSchema.parse({});
  }, [config]);

  const intervalMs = Math.min(300, Math.max(3, cfg.intervalSeconds)) * 1000;
  // 'cut' → instant swap; 'fade' (and 'zoom', not implemented — falls back to fade) → crossfade.
  const usesFade = cfg.transition !== 'cut';

  const [photos, setPhotos] = useState<string[]>([]);
  const [status, setStatus] = useState<FetchStatus>('loading');
  const [photoIndex, setPhotoIndex] = useState(0);
  const [fade, setFade] = useState(true);

  // Fetch the photo list; while active, refresh every 60s (this is also the offline retry).
  useEffect(() => {
    if (!isActive) return;
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch('/api/photos');
        if (!res.ok) throw new Error(`photos ${res.status}`);
        const data = (await res.json()) as string[];
        if (!cancelled) {
          setPhotos(data);
          setStatus('ok');
        }
      } catch {
        if (!cancelled) setStatus('offline');
      }
    }
    load();
    const id = setInterval(load, 60_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [isActive]);

  // Advance the slideshow. Only meaningful with 2+ photos.
  useEffect(() => {
    if (!isActive || photos.length < 2) return;
    if (!usesFade) {
      const id = setInterval(() => {
        setPhotoIndex((i) => (i + 1) % photos.length);
      }, intervalMs);
      return () => clearInterval(id);
    }
    let fadeTimer: number | undefined;
    const id = setInterval(() => {
      setFade(false);
      fadeTimer = window.setTimeout(() => {
        setPhotoIndex((i) => (i + 1) % photos.length);
        setFade(true);
      }, FADE_MS);
    }, intervalMs);
    return () => {
      clearInterval(id);
      if (fadeTimer !== undefined) clearTimeout(fadeTimer);
    };
  }, [isActive, photos.length, intervalMs, usesFade]);

  if (photos.length === 0) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center bg-black text-center">
        {status === 'offline' ? (
          <span className="font-mono text-[2.4vmin] text-white/30">offline — retrying</span>
        ) : status === 'ok' ? (
          <span className="max-w-[60%] font-mono text-[2.4vmin] text-white/30">
            No photos — add files to public/photos/ on this device
          </span>
        ) : null}
      </div>
    );
  }

  return (
    <div
      className="h-full w-full overflow-hidden bg-black"
      style={{
        opacity: fade ? 1 : 0,
        transition: usesFade ? `opacity ${FADE_MS}ms` : undefined,
      }}
    >
      <img
        src={`/photos/${photos[photoIndex % photos.length]}`}
        alt=""
        className="h-full w-full object-cover"
        draggable={false}
      />
    </div>
  );
}
