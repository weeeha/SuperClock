import { lazy } from 'react';
import { registerApp } from '../../core/registry';

registerApp({
  metadata: {
    id: 'ai-face',
    name: 'AI Face',
    icon: '\u{1F441}',
    description: 'An animated face for the assistant',
    category: 'ambient',
  },
  component: lazy(() => import('./AiFaceApp')),
});
