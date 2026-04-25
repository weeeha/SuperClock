import { lazy } from 'react';
import { registerApp } from '../../core/registry';

registerApp({
  metadata: {
    id: 'fireplace',
    name: 'Fireplace',
    icon: '\u{1F525}',
    description: 'Ambient fireplace animation',
    category: 'ambient',
    supportsInternalSwipe: false,
  },
  component: lazy(() => import('./FireplaceApp')),
});
