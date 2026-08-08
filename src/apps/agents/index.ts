import { lazy } from 'react';
import { registerApp } from '../../core/registry';

registerApp({
  metadata: {
    id: 'agents',
    name: 'Agents',
    icon: '\u{1F9E0}',
    description: 'Chat with your life-OS agents',
    category: 'productivity',
  },
  component: lazy(() => import('./AgentsApp')),
});
