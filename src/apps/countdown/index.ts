import { lazy } from 'react';
import { registerApp } from '../../core/registry';

registerApp({
  metadata: {
    id: 'countdown',
    name: 'Countdown',
    icon: '\u{23F3}',
    description: 'Days to a date',
    category: 'utility',
  },
  component: lazy(() => import('./CountdownApp')),
});
