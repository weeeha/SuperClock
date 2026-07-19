import { lazy } from 'react';
import { registerApp } from '../../core/registry';

registerApp({
  metadata: {
    id: 'breathing',
    name: 'Breathing',
    icon: '\u{1FAC1}',
    description: 'Respiration rate from the A121 mmWave radar',
    category: 'utility',
    supportsInternalSwipe: false,
    configSchemaId: 'app.breathing',
  },
  component: lazy(() => import('./BreathingApp')),
});
