/**
 * Photorealistic desk-art registry.
 *
 * The hardware renders are stored as keyed WebP under `/public/desk/`,
 * produced by `web/scripts/convert-art.mjs` (one-time, kept for reproducibility).
 * Every slug has two variants (`'a' | 'b'`); the active variant is a user
 * setting surfaced through `WorkstationContext`.
 */

export type ArtVariant = 'a' | 'b';

export type ArtSlug =
  | 'camera'
  | 'compass'
  | 'cassette'
  | 'floppy'
  | 'radar'
  | 'gps'
  | 'cyberdeck'
  | 'notebook-closed'
  | 'notebook-open'
  | 'polaroid'
  | 'nixie'
  | 'vacuum'
  | 'knob'
  | 'coil-cable'
  | 'loose-cable'
  | 'ribbon-cable'
  | 'vent'
  | 'plaque'
  | 'metal'
  | 'sticky';

/** Public path to a desk-art image for the given slug + variant. */
export function deskArt(slug: ArtSlug, variant: ArtVariant): string {
  return `/desk/${slug}-${variant}.webp`;
}
