// What each app's alert and lead window look like. Apps register from their
// index.ts; the layer looks the view up by the alert's appId.
import type { ComponentType } from 'react';
import type { RingingAlert, ScheduledAlert } from './alert-store';

export interface AlertViewProps {
  alert: RingingAlert;
  phase: 'ringing' | 'settled';
  dismiss: () => void;
}

export interface LeadViewProps {
  alert: ScheduledAlert;
  hide: () => void;
}

const views = new Map<string, ComponentType<AlertViewProps>>();
const leadViews = new Map<string, ComponentType<LeadViewProps>>();

export function registerAlertView(appId: string, view: ComponentType<AlertViewProps>): void {
  views.set(appId, view);
}

export function getAlertView(appId: string): ComponentType<AlertViewProps> | undefined {
  return views.get(appId);
}

export function registerLeadView(appId: string, view: ComponentType<LeadViewProps>): void {
  leadViews.set(appId, view);
}

export function getLeadView(appId: string): ComponentType<LeadViewProps> | undefined {
  return leadViews.get(appId);
}
