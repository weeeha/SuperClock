import { lazy } from 'react';
import { registerApp } from '../../core/registry';

registerApp({
  metadata: {
    id: 'weather',
    name: 'Weather',
    icon: '\u{26C5}',
    description: 'Current conditions and forecast',
    category: 'utility',
  },
  component: lazy(() => import('./WeatherApp')),
});
