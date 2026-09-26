import { z } from 'zod';
import type { FieldMetaMap } from '../types';

export const quoteAppSchema = z.object({
  source: z.enum(['builtin', 'url']).default('builtin'),
  sourceUrl: z.string().default(''),
  theme: z.enum(['light', 'dark']).default('light'),
  rotation: z.enum(['daily', 'hourly', 'every-visit']).default('daily'),
});

export const quoteAppMeta: FieldMetaMap = {
  source: {
    description:
      'Where quotes come from. Only "builtin" is implemented; "url" falls back to the built-in library.',
  },
  sourceUrl: {
    format: 'url',
    description: 'JSON endpoint returning [{ text, author }]',
    placeholder: 'https://example.com/quotes.json',
    showIf: (v) => v.source === 'url',
  },
  theme: {
    description:
      'Not implemented. The face reads the device day/night palette, so this setting changes nothing.',
  },
  rotation: { description: 'How often a new quote is picked' },
};

export type QuoteAppConfig = z.infer<typeof quoteAppSchema>;
