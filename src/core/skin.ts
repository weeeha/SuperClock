import { useDeviceConfig } from './device-config';
import type { SkinId } from '../shared/skins';

/** This clock's app skin from `settings.skin`, or undefined for today's look.
 *  An app reads it to pick a renderer; with none for the skin it keeps its
 *  current one (spec: docs/superpowers/specs/2026-10-01-app-skins-design.md). */
export function useSkin(): SkinId | undefined {
  return useDeviceConfig()?.settings.skin;
}
