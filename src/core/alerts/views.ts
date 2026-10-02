// What each app's alert looks like. Apps register from their index.ts; the
// layer looks the view up by the ringing alert's appId.
import type { ComponentType } from 'react';
import type { RingingAlert } from './alert-store';

export interface AlertViewProps {
  alert: RingingAlert;
  phase: 'ringing' | 'settled';
  dismiss: () => void;
}

const views = new Map<string, ComponentType<AlertViewProps>>();

export function registerAlertView(appId: string, view: ComponentType<AlertViewProps>): void {
  views.set(appId, view);
}

export function getAlertView(appId: string): ComponentType<AlertViewProps> | undefined {
  return views.get(appId);
}
