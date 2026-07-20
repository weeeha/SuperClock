/**
 * Quote library.
 *
 * Portrait URLs are Wikipedia REST `summary` thumbnails (330px). They load
 * over the network on the Pi kiosk; QuoteApp falls back to an initials
 * gradient if the image fails.
 */
export type Quote = {
  text: string;
  author: string;
  portrait?: string;
  wiki?: string;
};

export const quotes: Quote[] = [
  {
    text: 'The only way to do great work is to love what you do.',
    author: 'Steve Jobs',
    portrait:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/5/51/Steve_Jobs_Headshot_2010_%28cropped_4%29.jpg/330px-Steve_Jobs_Headshot_2010_%28cropped_4%29.jpg',
    wiki: 'https://en.wikipedia.org/wiki/Steve_Jobs',
  },
  {
    text: 'Innovation distinguishes between a leader and a follower.',
    author: 'Steve Jobs',
    portrait:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/5/51/Steve_Jobs_Headshot_2010_%28cropped_4%29.jpg/330px-Steve_Jobs_Headshot_2010_%28cropped_4%29.jpg',
    wiki: 'https://en.wikipedia.org/wiki/Steve_Jobs',
  },
  {
    text: 'Stay hungry, stay foolish.',
    author: 'Steve Jobs',
    portrait:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/5/51/Steve_Jobs_Headshot_2010_%28cropped_4%29.jpg/330px-Steve_Jobs_Headshot_2010_%28cropped_4%29.jpg',
    wiki: 'https://en.wikipedia.org/wiki/Steve_Jobs',
  },
  {
    text: "Life is what happens when you're busy making other plans.",
    author: 'John Lennon',
    portrait:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/2/27/John_Lennon_%22Walls_and_Bridges%22_1974_press_photo_%284x5_cropped%29.jpg/330px-John_Lennon_%22Walls_and_Bridges%22_1974_press_photo_%284x5_cropped%29.jpg',
    wiki: 'https://en.wikipedia.org/wiki/John_Lennon',
  },
  {
    text: 'The future belongs to those who believe in the beauty of their dreams.',
    author: 'Eleanor Roosevelt',
    portrait:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7d/Eleanor_Roosevelt_at_the_United_Nations%2C_circa_1946-1947_%283x4_cropped%29.jpg/330px-Eleanor_Roosevelt_at_the_United_Nations%2C_circa_1946-1947_%283x4_cropped%29.jpg',
    wiki: 'https://en.wikipedia.org/wiki/Eleanor_Roosevelt',
  },
  {
    text: 'It is during our darkest moments that we must focus to see the light.',
    author: 'Aristotle',
    portrait:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ae/Aristotle_Altemps_Inv8575.jpg/330px-Aristotle_Altemps_Inv8575.jpg',
    wiki: 'https://en.wikipedia.org/wiki/Aristotle',
  },
  {
    text: 'The purpose of our lives is to be happy.',
    author: 'Dalai Lama',
    portrait:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/f/fb/The_Dalai_Lama_in_2012.jpg/330px-The_Dalai_Lama_in_2012.jpg',
    wiki: 'https://en.wikipedia.org/wiki/14th_Dalai_Lama',
  },
  {
    text: 'In the middle of difficulty lies opportunity.',
    author: 'Albert Einstein',
    portrait:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/2/28/Albert_Einstein_Head_cleaned.jpg/330px-Albert_Einstein_Head_cleaned.jpg',
    wiki: 'https://en.wikipedia.org/wiki/Albert_Einstein',
  },
];
