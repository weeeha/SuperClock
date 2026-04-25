import type { AppDefinition } from './types';

const registry: Map<string, AppDefinition> = new Map();

export function registerApp(app: AppDefinition): void {
  registry.set(app.metadata.id, app);
}

export function getApp(id: string): AppDefinition | undefined {
  return registry.get(id);
}

export function getAllApps(): AppDefinition[] {
  return Array.from(registry.values());
}

export function getAppIds(): string[] {
  return Array.from(registry.keys());
}
