import type { LazyExoticComponent, ComponentType } from 'react';
import type { FaceDescriptor } from '../shared/types';

export interface AppMetadata {
  id: string;
  name: string;
  icon: string;
  description: string;
  category: 'utility' | 'ambient' | 'productivity';
  /** If true, the app handles left/right swipe internally (e.g., switching watch faces) */
  supportsInternalSwipe: boolean;
  /** Optional: zod schema id for this app's per-instance config (resolved in src/shared/schemas/) */
  configSchemaId?: string;
  /** Optional: only the Clock app populates this — its registered face descriptors */
  faces?: FaceDescriptor[];
}

export interface AppProps {
  isActive: boolean;
  /** Called when the app wants to signal internal swipe is exhausted and shell should navigate */
  onSwipeOut?: (direction: 'left' | 'right') => void;
  /** Optional per-instance configuration, shape resolved via AppMetadata.configSchemaId */
  config?: Record<string, unknown>;
}

export interface AppDefinition {
  metadata: AppMetadata;
  component: LazyExoticComponent<ComponentType<AppProps>>;
}
