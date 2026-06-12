import { useState } from 'react';

const quotes = [
  { text: 'The only way to do great work is to love what you do.', author: 'Steve Jobs' },
  { text: 'Innovation distinguishes between a leader and a follower.', author: 'Steve Jobs' },
  { text: 'Stay hungry, stay foolish.', author: 'Steve Jobs' },
  { text: 'Life is what happens when you\'re busy making other plans.', author: 'John Lennon' },
  { text: 'The future belongs to those who believe in the beauty of their dreams.', author: 'Eleanor Roosevelt' },
  { text: 'It is during our darkest moments that we must focus to see the light.', author: 'Aristotle' },
  { text: 'The purpose of our lives is to be happy.', author: 'Dalai Lama' },
  { text: 'In the middle of difficulty lies opportunity.', author: 'Albert Einstein' },
];

/** Quote of the Day — based on Figma S16 design (489:21143) */
export default function QuoteApp() {
  // The quote is deterministic for the calendar day, so compute it once via a
  // lazy initializer instead of syncing it through an Effect.
  const [quote] = useState(() => {
    const dayOfYear = Math.floor(
      (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000,
    );
    return quotes[dayOfYear % quotes.length];
  });

  return (
    <div className="theme-fade flex h-full w-full flex-col items-center justify-center bg-(--face-bg) p-[12%] gap-[4%]">
      {/* Author avatar placeholder */}
      <div className="h-[12%] w-[12%] rounded-full bg-gray-300" />

      {/* Author name */}
      <p className="theme-fade text-[3.5vmin] text-(--face-ink-muted)">{quote.author}</p>

      {/* Quote text */}
      <p className="theme-fade text-[5vmin] font-semibold text-center leading-snug text-(--face-ink)">
        "{quote.text}"
      </p>
    </div>
  );
}
