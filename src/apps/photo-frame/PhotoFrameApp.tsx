import { useState, useEffect } from 'react';
import type { AppProps } from '../../core/types';

// Placeholder gradient backgrounds as demo photos
const demoPhotos = [
  'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
  'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
  'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
  'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
];

/** Photo Frame — based on Figma S15 design (489:21288). Circular photo with crossfade. */
export default function PhotoFrameApp({ isActive }: AppProps) {
  const [photoIndex, setPhotoIndex] = useState(0);
  const [fade, setFade] = useState(true);

  useEffect(() => {
    if (!isActive) return;
    const id = setInterval(() => {
      setFade(false);
      setTimeout(() => {
        setPhotoIndex((i) => (i + 1) % demoPhotos.length);
        setFade(true);
      }, 500);
    }, 8000);
    return () => clearInterval(id);
  }, [isActive]);

  return (
    <div className="flex h-full w-full items-center justify-center bg-black">
      <div
        className="rounded-full w-[90%] aspect-square overflow-hidden transition-opacity duration-500"
        style={{
          opacity: fade ? 1 : 0,
          background: demoPhotos[photoIndex],
        }}
      />
    </div>
  );
}
