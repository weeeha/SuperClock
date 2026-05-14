import { useState, useEffect, useMemo } from 'react';
import type { AppProps } from '../../core/types';
import { quotes } from './quotes';

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function hueOf(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return h % 360;
}

/** Quote of the Day — based on Figma S16 design (489:21143). Tap to cycle. */
export default function QuoteApp(_props: AppProps) {
  const [index, setIndex] = useState(0);
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    const dayOfYear = Math.floor(
      (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000,
    );
    setIndex(dayOfYear % quotes.length);
  }, []);

  const quote = quotes[index];
  const initials = useMemo(() => initialsOf(quote.author), [quote.author]);
  const hue = useMemo(() => hueOf(quote.author), [quote.author]);
  const fallbackBg = `linear-gradient(135deg, hsl(${hue} 55% 55%), hsl(${(hue + 40) % 360} 60% 40%))`;
  const showImg = quote.portrait && !imgFailed;

  return (
    <div
      onClick={() => {
        setImgFailed(false);
        setIndex((i) => (i + 1) % quotes.length);
      }}
      className="flex h-full w-full flex-col items-center justify-center bg-white text-black p-[12%] gap-[4%] cursor-pointer select-none"
    >
      <div
        className="flex h-[22%] w-[22%] items-center justify-center overflow-hidden rounded-full text-white font-semibold"
        style={!showImg ? { background: fallbackBg, fontSize: '6vmin' } : undefined}
      >
        {showImg ? (
          <img
            src={quote.portrait}
            alt={quote.author}
            referrerPolicy="no-referrer"
            onError={() => setImgFailed(true)}
            className="h-full w-full object-cover"
          />
        ) : (
          initials
        )}
      </div>

      <p className="text-[3.5vmin] text-gray-600">{quote.author}</p>

      <p className="text-[5vmin] font-semibold text-center leading-snug text-gray-900">
        "{quote.text}"
      </p>
    </div>
  );
}
