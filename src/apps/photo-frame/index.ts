import { lazy } from 'react';
import { registerApp } from '../../core/registry';

registerApp({
  metadata: {
    id: 'photo-frame',
    name: 'Photos',
    icon: '\u{1F5BC}',
    description: 'Photo frame with slideshow',
    category: 'ambient',
    supportsInternalSwipe: false,
  },
  component: lazy(() => import('./PhotoFrameApp')),
});
