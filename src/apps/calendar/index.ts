import { lazy } from 'react';
import { registerApp } from '../../core/registry';

registerApp({
  metadata: {
    id: 'calendar',
    name: 'Calendar',
    icon: '\u{1F4C5}',
    description: 'Today\'s date at a glance',
    category: 'utility',
  },
  component: lazy(() => import('./CalendarApp')),
});
