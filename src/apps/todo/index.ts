import { lazy } from 'react';
import { registerApp } from '../../core/registry';

registerApp({
  metadata: {
    id: 'todo',
    name: 'Todo',
    icon: '\u{2611}\u{FE0F}',
    description: 'Flat todo list — tap to complete',
    category: 'productivity',
  },
  component: lazy(() => import('./TodoApp')),
});
