import { lazy } from 'react';
import { registerApp } from '../../core/registry';

registerApp({
  metadata: {
    id: 'fitness',
    name: 'Fitness',
    icon: '\u{1F4AA}',
    description: '7-minute workout circuits with a guided timer',
    category: 'productivity',
  },
  component: lazy(() => import('./FitnessApp')),
});
