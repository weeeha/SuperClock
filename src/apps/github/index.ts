import { lazy } from 'react';
import { registerApp } from '../../core/registry';

registerApp({
  metadata: {
    id: 'github',
    name: 'GitHub',
    icon: '\u{1F4BB}',
    description: 'GitHub contribution heatmap in a radial watch face',
    category: 'productivity',
  },
  component: lazy(() => import('./GithubApp')),
});
