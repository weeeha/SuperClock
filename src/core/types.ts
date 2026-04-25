import type { LazyExoticComponent, ComponentType } from 'react';

export interface AppMetadata {
  id: string;
  name: string;
  icon: string;
  description: string;
  category: 'utility' | 'ambient' | 'productivity';
  /** If true, the app handles left/right swipe internally (e.g., switching watch faces) */
  supportsInternalSwipe: boolean;
}

export interface AppProps {
  isActive: boolean;
  /** Called when the app wants to signal internal swipe is exhausted and shell should navigate */
  onSwipeOut?: (direction: 'left' | 'right') => void;
}

export interface AppDefinition {
  metadata: AppMetadata;
  component: LazyExoticComponent<ComponentType<AppProps>>;
}
