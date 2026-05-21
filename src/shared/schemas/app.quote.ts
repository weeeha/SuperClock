import { z } from 'zod';
import type { FieldMetaMap } from '../types';

export const quoteAppSchema = z.object({
  source: z.enum(['builtin', 'url']).default('builtin'),
  sourceUrl: z.string().default(''),
  theme: z.enum(['light', 'dark']).default('light'),
  rotation: z.enum(['daily', 'hourly', 'every-visit']).default('daily'),
});

export const quoteAppMeta: FieldMetaMap = {
  source: { description: 'Where quotes come from' },
  sourceUrl: {
    format: 'url',
    description: 'JSON endpoint returning [{ text, author }]',
    placeholder: 'https://example.com/quotes.json',
    showIf: (v) => v.source === 'url',
  },
  theme: { description: 'Background and text color pairing' },
  rotation: { description: 'How often a new quote is picked' },
};

export type QuoteAppConfig = z.infer<typeof quoteAppSchema>;
