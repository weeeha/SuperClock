import { lazy } from 'react';
import { registerApp } from '../../core/registry';

registerApp({
  metadata: {
    id: 'todo',
    name: 'Todo',
    icon: '\u{1F4DD}',
    description: 'One flat list: tap to complete, swipe up for done',
    category: 'productivity',
  },
  component: lazy(() => import('./TodoApp')),
});
