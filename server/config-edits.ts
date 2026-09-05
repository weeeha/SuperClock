import type { DeviceConfig, ScreenInstance } from '../src/shared/types';

/** A created screen joins the rotation immediately — symmetric with the
 *  DELETE handler, which drops the playlist entry in the same write. Without
 *  this, created screens were invisible to the playlist (found empirically by
 *  the Add-Screen surface build). Pure so config-edits.test.ts can pin it. */
export function withNewInstance(cfg: DeviceConfig, instance: ScreenInstance): DeviceConfig {
  return {
    ...cfg,
    instances: [...cfg.instances, instance],
    playlist: { ...cfg.playlist, items: [...cfg.playlist.items, instance.id] },
  };
}
