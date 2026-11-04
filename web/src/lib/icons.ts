/**
 * Code-defined SVG glyph pack for badges & categories.
 *
 * Glyphs are stroke-based 24×24 shapes rendered with `currentColor`, so they
 * inherit whichever theme token they sit inside (Roam Classic or ROAM-OS) —
 * no fixed-colour emoji, no raster PNGs, no per-theme assets.
 *
 * Resolution order for a badge: exact slug → category → legacy-alias
 * category → DEFAULT_GLYPH. Missing glyphs are added here (SVG paths), or for
 * semantic gaps via the prompt process in web/ICON-PROMPTS.local.md — rather
 * than falling back to raw emoji.
 */

export type IconDef = {
  /** Inner SVG markup (paths/circles/rects) rendered inside a 24×24 <svg>. */
  children: string;
};

const g = (children: string): IconDef => ({ children });

// ── Category glyphs (one per category; also the badge fallback) ───────────
export const CATEGORY_GLYPHS: Record<string, IconDef> = {
  exploration: g(
    '<circle cx="12" cy="12" r="9"/><path d="M15.8 8.2l-2.2 5.4-5.4 2.2 2.2-5.4z"/>',
  ),
  collecting: g(
    '<path d="M4 6.2l8-2.4 8 2.4-8 2.4z"/><path d="M4 12l8-2.4 8 2.4-8 2.4z"/><path d="M4 17.8l8-2.4 8 2.4-8 2.4z"/>',
  ),
  curating: g(
    '<path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4z"/><path d="M5 20h14"/>',
  ),
  social: g(
    '<circle cx="9" cy="8" r="3.5"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><path d="M16 5.6a3.5 3.5 0 0 1 0 6.1"/><path d="M17.5 14.5c1.6.4 2.5 1.9 2.5 4.5"/>',
  ),
  streaks: g(
    '<path d="M12 3s5 4.6 5 9a5 5 0 0 1-10 0c0-1.4.5-2.7 1.3-3.8C8.8 9.4 9.3 10.6 10 11c.1-2.6 1-4.8 2-8z"/>',
  ),
  contributing: g(
    '<path d="M9 6h11M9 12h11M9 18h11"/><path d="M4 6l1.2 1.2L7 5.5M4 12l1.2 1.2L7 11.5M4 18l1.2 1.2L7 17.5"/>',
  ),
  curiosity: g(
    '<path d="M12 20s-7-4.3-7-9.2A3.8 3.8 0 0 1 12 7a3.8 3.8 0 0 1 7 3.8C19 15.7 12 20 12 20z"/>',
  ),
  games: g(
    '<path d="M8 4h8v4a4 4 0 0 1-8 0z"/><path d="M8 6H4.5a2 2 0 0 0 2 4M16 6h3.5a2 2 0 0 1-2 4"/><path d="M12 12v4M8 20h8M10 16h4"/>',
  ),
  secret: g(
    '<rect x="5" y="11" width="14" height="8" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  ),
  milestone: g(
    '<circle cx="12" cy="13.5" r="5.5"/><path d="M12 19l-1.6 3h3.2z"/><path d="M8.5 6.5L7.5 3l3 2.5M15.5 6.5L16.5 3l-3 2.5"/>',
  ),
  gift: g(
    '<rect x="4" y="8" width="16" height="4"/><rect x="6" y="12" width="12" height="7"/><path d="M12 8v11M12 8S7.5 7 6.5 4.7C5.8 3 8.3 2.6 9.8 4 10.8 5 12 6.8 12 8M12 8s4.5-1 5.5-3.3C18.2 3 15.7 2.6 14.2 4 13.2 5 12 6.8 12 8"/>',
  ),
};

/** Generic medal — used when neither slug nor category resolve. */
export const DEFAULT_GLYPH: IconDef = g(
  '<circle cx="12" cy="12" r="9"/><path d="M12 7.6l1.7 3.5 3.9.5-2.9 2.7.7 3.9-3.4-1.9-3.4 1.9.7-3.9-2.9-2.7 3.9-.5z"/>',
);

/** Question-mark medal — rendered for locked, unrevealed (hidden) badges. */
export const HIDDEN_GLYPH: IconDef = g(
  '<circle cx="12" cy="12" r="9"/><path d="M9.7 9.4a2.4 2.4 0 1 1 3.3 2.2c-.9.4-1 .9-1 1.7"/><path d="M12 16.4h.01"/>',
);

// ── Extra glyphs (available for specific badges / future GPT handoff) ─────
const CLOCK: IconDef = g('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.2 1.8"/>');
const REFRESH: IconDef = g('<path d="M20 12a8 8 0 1 1-3-6.3"/><path d="M20 3v5h-5"/>');

// ── Per-badge overrides (slug → glyph) ────────────────────────────────────
export const BADGE_GLYPHS: Record<string, IconDef> = {
  "time-traveler": CLOCK,
  comeback: REFRESH,
};

/** Legacy `engagement` category was renamed to `curiosity`
 *  (20261103000002_unify_xp_badges.sql). Keep a soft mapping so any stale
 *  row still resolves to the right glyph. */
export function normalizeCategory(category: string): string {
  return category === "engagement" ? "curiosity" : category;
}

export function resolveBadgeGlyph(slug: string, category: string): IconDef {
  return (
    BADGE_GLYPHS[slug] ??
    CATEGORY_GLYPHS[normalizeCategory(category)] ??
    CATEGORY_GLYPHS[category] ??
    DEFAULT_GLYPH
  );
}

/** Tier ring colour (Tailwind text token class), theme-safe, `null` = none. */
export const TIER_RING: Record<number, string | null> = {
  0: null,
  1: "text-ember",
  2: "text-muted",
  3: "text-gold",
  4: "text-phosphor",
  5: "text-gold-bright",
};
