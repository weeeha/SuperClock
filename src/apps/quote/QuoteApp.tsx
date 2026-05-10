import { useState, useEffect } from 'react';
import type { AppProps } from '../../core/types';

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
export default function QuoteApp(_props: AppProps) {
  const [quote, setQuote] = useState(quotes[0]);

  useEffect(() => {
    // Pick quote based on day of year for consistency
    const dayOfYear = Math.floor(
      (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000,
    );
    setQuote(quotes[dayOfYear % quotes.length]);
  }, []);

  return (
    <div className="flex h-full w-full flex-col items-center justify-center bg-white text-black p-[12%] gap-[4%]">
      {/* Author avatar placeholder */}
      <div className="h-[12%] w-[12%] rounded-full bg-gray-300" />

      {/* Author name */}
      <p className="text-[3.5vmin] text-gray-600">{quote.author}</p>

      {/* Quote text */}
      <p className="text-[5vmin] font-semibold text-center leading-snug text-gray-900">
        "{quote.text}"
      </p>
    </div>
  );
}
