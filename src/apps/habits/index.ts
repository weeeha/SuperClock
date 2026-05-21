import { lazy } from 'react';
import { registerApp } from '../../core/registry';

registerApp({
  metadata: {
    id: 'habits',
    name: 'Habits',
    icon: '\u{2705}',
    description: 'Daily habit tracker with streaks',
    category: 'productivity',
    supportsInternalSwipe: false,
    configSchemaId: 'app.habits',
  },
  component: lazy(() => import('./HabitsApp')),
});
