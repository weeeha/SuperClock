import { lazy } from 'react';
import { registerApp } from '../../core/registry';

registerApp({
  metadata: {
    id: 'fitness',
    name: 'Fitness',
    icon: '\u{1F4AA}',
    description: 'Exercise counter with progress ring',
    category: 'productivity',
  },
  component: lazy(() => import('./FitnessApp')),
});
