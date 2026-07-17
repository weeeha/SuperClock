import { lazy } from 'react';
import { registerApp } from '../../core/registry';

registerApp({
  metadata: {
    id: 'claude-usage',
    name: 'Claude Usage',
    icon: '\u{1F43E}',
    description: 'Session + weekly Claude Code rate-limit utilization with mood-aware Clawd',
    category: 'productivity',
  },
  component: lazy(() => import('./ClaudeUsageApp')),
});
