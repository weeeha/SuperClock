import { lazy } from 'react';
import { registerApp } from '../../core/registry';
import { FACES } from '../../shared/face-registry';

registerApp({
  metadata: {
    id: 'clock',
    name: 'Clock',
    icon: '\u{1F570}',
    description: 'Watch faces with analog and productivity views',
    category: 'utility',
    faces: FACES,
  },
  component: lazy(() => import('./ClockApp')),
});
