import { lazy } from 'react';
import { registerApp } from '../../core/registry';

registerApp({
  metadata: {
    id: 'art',
    name: 'Art',
    icon: '\u{1F5BC}️', // 🖼️ framed picture
    description: 'Ambient gallery — rotating works from open-access museum collections',
    category: 'ambient',
    supportsInternalSwipe: false,
  },
  component: lazy(() => import('./ArtApp')),
});
