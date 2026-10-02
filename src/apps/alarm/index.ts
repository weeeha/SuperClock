import { lazy } from 'react';
import { registerApp } from '../../core/registry';

registerApp({
  metadata: {
    id: 'alarm',
    name: 'Alarm',
    icon: '\u{23F0}',
    description: 'Alarms that wake the panel',
    category: 'utility',
  },
  component: lazy(() => import('./AlarmApp')),
});
