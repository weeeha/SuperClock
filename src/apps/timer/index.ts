import { lazy } from 'react';
import { registerApp } from '../../core/registry';
import { registerAlertView } from '../../core/alerts/views';

registerApp({
  metadata: {
    id: 'timer',
    name: 'Timer',
    icon: '\u{23F2}',
    description: 'Timer with a dial and presets',
    category: 'utility',
  },
  component: lazy(() => import('./TimerApp')),
});

registerAlertView('timer', lazy(() => import('./TimerAlert')));
