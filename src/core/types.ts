import type { LazyExoticComponent, ComponentType } from 'react';
import type { FaceDescriptor } from '../shared/types';

export interface AppMetadata {
  id: string;
  name: string;
  icon: string;
  description: string;
  category: 'utility' | 'ambient' | 'productivity';
  /** Optional: only the Clock app populates this — its registered face descriptors */
  faces?: FaceDescriptor[];
}

// Note: an app's config schema id is `app.<id>` by convention — advertised
// via src/shared/capabilities.ts descriptors and pinned by
// registry-coherence.test.ts. Apps that consume horizontal/vertical swipes
// internally register a callback on the navigation store (see ClockApp's
// setVerticalSwipeCallback usage) rather than declaring a metadata flag.

export interface AppProps {
  isActive: boolean;
  /** Optional per-instance configuration (shape: the app's `app.<id>` schema,
   *  plus `faceId`/`face` for clock instances). */
  config?: Record<string, unknown>;
}

export interface AppDefinition {
  metadata: AppMetadata;
  component: LazyExoticComponent<ComponentType<AppProps>>;
}
