import { lazy } from 'react';
import { registerApp } from '../../core/registry';
import { registerAlertView, registerLeadView } from '../../core/alerts/views';
import { startAlarmSync } from './alarm-sync';

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

registerAlertView('alarm', lazy(() => import('./AlarmAlert')));
registerLeadView('alarm', lazy(() => import('./AlarmLead')));

// Keep one core alert per enabled alarm from boot, whichever app is showing.
startAlarmSync();
