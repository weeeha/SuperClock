// App skins: one device-wide look for the kiosk apps, chosen per clock in
// `settings.skin`. Unset means today's look, and an app with no renderer for
// the chosen skin keeps today's look too, so skins ship one app at a time.
// Spec: docs/superpowers/specs/2026-10-01-app-skins-design.md.
//
// Only skins with at least one shipped renderer are listed. Adding an id is a
// minor schema change (an enum widening); removing one is breaking.
export const SKIN_IDS = ['fields'] as const;

export type SkinId = (typeof SKIN_IDS)[number];

export const SKIN_LABELS: Record<SkinId, string> = {
  // Variant B of the Signal-colour skin: the disc is the app's category hue,
  // ink is black by day and the hue by night.
  fields: 'Fields',
};
