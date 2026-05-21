import { lazy } from 'react';
import { registerApp } from '../../core/registry';

registerApp({
  metadata: {
    id: 'time-tracking',
    name: 'Timer',
    icon: '\u{23F1}',
    description: 'Pomodoro focus timer',
    category: 'productivity',
    supportsInternalSwipe: false,
    configSchemaId: 'app.time-tracking',
  },
  component: lazy(() => import('./TimeTrackingApp')),
});
