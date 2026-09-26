/**
 * Quote library.
 *
 * Every entry carries the work it comes from. Misattribution is the standard
 * failure of quote collections, so provenance lives in the data even though
 * the face does not render it: a line whose source cannot be named does not
 * belong here. Lines are capped at 140 characters, which is what the face can
 * carry at two type sizes on a 1080px disc read from across a room.
 *
 * Excerpts are marked in `source` where the passage continues past what is
 * shown. No line here is trimmed in a way that changes what it says.
 */
export type Quote = {
  /** The line as written. 140 characters or fewer. */
  text: string;
  author: string;
  /** Work, letter or talk it comes from, with a year where one is known. */
  source: string;
};

export const quotes: Quote[] = [
  // Time
  {
    text: 'How we spend our days is, of course, how we spend our lives.',
    author: 'Annie Dillard',
    source: 'The Writing Life, 1989',
  },
  {
    text: 'It is not that we have a short time to live, but that we waste a lot of it.',
    author: 'Seneca',
    source: 'On the Shortness of Life, c. 49',
  },
  {
    text: 'We suffer more often in imagination than in reality.',
    author: 'Seneca',
    source: 'Letters to Lucilius, c. 65',
  },
  {
    text: 'You could leave life right now. Let that determine what you do and say and think.',
    author: 'Marcus Aurelius',
    source: 'Meditations 2.11, Hays translation',
  },
  {
    text: 'The impediment to action advances action. What stands in the way becomes the way.',
    author: 'Marcus Aurelius',
    source: 'Meditations 5.20, Hays translation',
  },
  {
    text: 'Time is the substance I am made of. Time is a river which sweeps me along, but I am the river.',
    author: 'Jorge Luis Borges',
    source: 'A New Refutation of Time, 1946 (excerpt)',
  },
  {
    text: 'Dost thou love life? Then do not squander time, for that is the stuff life is made of.',
    author: 'Benjamin Franklin',
    source: "Poor Richard's Almanack, 1746",
  },
  {
    text: 'Time is what we want most, but what we use worst.',
    author: 'William Penn',
    source: 'Some Fruits of Solitude, 1693',
  },
  {
    text: 'Procrastination is the thief of time.',
    author: 'Edward Young',
    source: 'Night-Thoughts, 1742',
  },
  {
    text: 'Every hour wounds. The last one kills.',
    author: 'Sundial motto',
    source: 'Latin: vulnerant omnes, ultima necat',
  },
  {
    text: 'The years teach much which the days never know.',
    author: 'Ralph Waldo Emerson',
    source: 'Experience, 1844',
  },
  {
    text: 'The two most powerful warriors are patience and time.',
    author: 'Leo Tolstoy',
    source: 'War and Peace, 1869',
  },

  // Attention
  {
    text: 'Attention is the rarest and purest form of generosity.',
    author: 'Simone Weil',
    source: 'Letter to Joë Bousquet, 1942',
  },
  {
    text: 'My experience is what I agree to attend to.',
    author: 'William James',
    source: 'The Principles of Psychology, 1890',
  },
  {
    text: 'The faculty of voluntarily bringing back a wandering attention is the very root of judgment, character, and will.',
    author: 'William James',
    source: 'The Principles of Psychology, 1890 (excerpt)',
  },
  {
    text: 'To pay attention, this is our endless and proper work.',
    author: 'Mary Oliver',
    source: 'Yes! No!, in White Pine, 1994',
  },
  {
    text: 'It is not enough to be busy. So are the ants. The question is: what are we busy about?',
    author: 'Henry David Thoreau',
    source: 'Letter to H. G. O. Blake, 1853',
  },
  {
    text: 'Our life is frittered away by detail. Simplify, simplify.',
    author: 'Henry David Thoreau',
    source: 'Walden, 1854',
  },

  // Making
  {
    text: 'Less, but better.',
    author: 'Dieter Rams',
    source: 'Weniger, aber besser',
  },
  {
    text: 'Good design is as little design as possible.',
    author: 'Dieter Rams',
    source: 'Ten Principles for Good Design, 1970s',
  },
  {
    text: 'The details are not the details. They make the design.',
    author: 'Charles Eames',
    source: 'Attributed in Eames Demetrios, An Eames Primer',
  },
  {
    text: 'Perfection is achieved not when there is nothing more to add, but when there is nothing left to take away.',
    author: 'Antoine de Saint-Exupéry',
    source: 'Wind, Sand and Stars, 1939',
  },
  {
    text: 'We should forget about small efficiencies, say about 97% of the time: premature optimization is the root of all evil.',
    author: 'Donald Knuth',
    source: 'Structured Programming with go to Statements, 1974',
  },
  {
    text: 'Programs must be written for people to read, and only incidentally for machines to execute.',
    author: 'Abelson and Sussman',
    source: 'Structure and Interpretation of Computer Programs, 1985',
  },
  {
    text: 'Simplicity is prerequisite for reliability.',
    author: 'Edsger Dijkstra',
    source: 'EWD498, 1975',
  },
  {
    text: 'The purpose of computing is insight, not numbers.',
    author: 'Richard Hamming',
    source: 'Numerical Methods for Scientists and Engineers, 1962',
  },
  {
    text: 'The best way to predict the future is to invent it.',
    author: 'Alan Kay',
    source: 'Talk at Xerox PARC, 1971',
  },
  {
    text: 'Simple things should be simple, complex things should be possible.',
    author: 'Alan Kay',
    source: 'On the design of Smalltalk',
  },
  {
    text: 'Make it work, make it right, make it fast.',
    author: 'Kent Beck',
    source: 'Extreme Programming',
  },
  {
    text: 'No great thing is created suddenly, any more than a bunch of grapes or a fig.',
    author: 'Epictetus',
    source: 'Discourses 1.15',
  },
  {
    text: 'He who has a why to live can bear almost any how.',
    author: 'Friedrich Nietzsche',
    source: 'Twilight of the Idols, 1889',
  },
];
