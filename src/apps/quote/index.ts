import { lazy } from 'react';
import { registerApp } from '../../core/registry';

registerApp({
  metadata: {
    id: 'quote',
    name: 'Quote',
    icon: '\u{1F4AC}',
    description: 'Quote of the day',
    category: 'ambient',
    supportsInternalSwipe: false,
  },
  component: lazy(() => import('./QuoteApp')),
});
