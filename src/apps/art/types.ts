/** A single artwork, normalized across museum source APIs. */
export interface Artwork {
  /** Globally unique across sources, e.g. "aic-12345". */
  id: string;
  source: 'aic' | 'met' | 'cma';
  /** Always set — falls back to "Untitled". */
  title: string;
  /** May be empty for anonymous works. */
  artist: string;
  /** Pre-formatted human string ("1889", "c. 1850"), may be empty. */
  date: string;
  /** Museum display name, e.g. "Art Institute of Chicago". */
  museum: string;
  /** Full-size image URL — we request a target pixel width per source. */
  imageUrl: string;
}
