import { lazy } from 'react';
import { registerApp } from '../../core/registry';

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
