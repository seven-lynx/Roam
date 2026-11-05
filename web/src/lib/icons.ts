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
// ── Per-badge concept glyphs (base shapes; tiers add a pip accent) ──────
// ── exploration ──────────────────────────────────────────────────────────
const WANDERER: IconDef = g('<path d="M12 21s-7-5.2-7-10.3A4.7 4.7 0 0 1 12 5a4.7 4.7 0 0 1 7 5.7C19 15.8 12 21 12 21z"/><circle cx="12" cy="10.4" r="2"/>');
const NOMAD: IconDef = g('<path d="M3.5 19 12 4l8.5 15z"/><path d="M8.5 19l3.5-6.5L15.5 19"/><path d="M3.5 19h17"/>');
const GLOBETROTTER: IconDef = g('<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3c2.6 2.7 4 5.8 4 9s-1.4 6.3-4 9c-2.6-2.7-4-5.8-4-9s1.4-6.3 4-9z"/>');
const CATEGORY_EXPLORER: IconDef = g('<rect x="4" y="4" width="7" height="7"/><rect x="13" y="4" width="7" height="7"/><rect x="4" y="13" width="7" height="7"/><circle cx="16.5" cy="16.5" r="2.6"/><path d="M18.4 18.4 21.5 21.5"/>');
const CENTURY_CLUB: IconDef = g('<path d="M4 9c2.5-4 4.5-4 8-1.5C15.5 5 17.5 5 20 9c-2.5 4-4.5 4.5-8 3-3.5 1.5-5.5 1-8-3z"/><path d="M12 11.5V19M8.5 19h7"/>');
const CURIOUS_GEORGE: IconDef = g('<circle cx="12" cy="12" r="7.5"/><circle cx="12" cy="12" r="3"/>');
const DAILY_DOUBLE: IconDef = g('<rect x="5.5" y="5.5" width="9" height="9" rx="1.5"/><rect x="9.5" y="9.5" width="9" height="9" rx="1.5"/>');
const DAWN_PATROL: IconDef = g('<path d="M3 16h18"/><path d="M8 16a4 4 0 0 1 8 0"/><path d="M12 6V3"/><path d="M6.5 7.5 4.5 5.5"/><path d="M17.5 7.5l2-2"/>');
const DAY_TRIPPER: IconDef = g('<circle cx="6" cy="6" r="2.6"/><path d="M6 2.9V2M9.1 6H10M6 9.1V10M2.9 6H2"/><path d="M4 20c0-5 3-9 9-9 6 0 8 4 7 9"/>');
const DEEP_DIVE: IconDef = g('<path d="M12 4v11"/><path d="M8 11l4 5 4-5"/><path d="M4 19c1.5-2 2.5-2 4 0s2.5 2 4 0 2.5-2 4 0 2.5 2 4 0"/>');
const DOMAIN_HOARDER: IconDef = g('<circle cx="12" cy="7" r="4.5"/><path d="M5.5 14h13"/><path d="M7 14l-1.8 6h13.6L17 14"/>');
const EARLY_BIRD: IconDef = g('<path d="M8 10c3-2.5 6-3 10-2M9 12h8M6 14l3-2M6 14l-1 3h3M15 14l1 3h-3"/>');
const EXPLORER_SUPREME: IconDef = g('<path d="M5 5c2 2 3 5 3 9s-1 7-3 9c2-2 3-5 3-9s-1-7-3-9zm14 0c-2 2-3 5-3 9s1 7 3 9c-2-2-3-5-3-9s1-7 3-9z"/><path d="M12 8v9"/>');
const FIFTY_FIFTY: IconDef = g('<circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 1 0 18z"/>');
const FIRST_ROAM: IconDef = g('<path d="M5 21V4l14-2v17"/><path d="M5 21l14-2"/><path d="M5 4l14-2"/>');
const FRESH_FINDS: IconDef = g('<path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6z"/><path d="M19 15l.7 1.8L21.5 17.5l-1.8.7L19 20l-.7-1.8-1.8-.7 1.8-.7z"/>');
const HOME_TURF: IconDef = g('<path d="M4 11l8-7 8 7"/><path d="M6 9v10h12V9"/><path d="M10 19v-5h4v5"/>');
const INSOMNIAC: IconDef = g('<path d="M14.5 4.5a6 6 0 0 0-2 9A7 7 0 1 1 6 6.5a6 6 0 0 0 8.5-2z"/><circle cx="15" cy="5" r="1"/>');
const JET_SETTER: IconDef = g('<path d="M10 12.5 3 15v-2l7-2.5L12 4l2.5 6.5L21 13v2l-7-2.5-2 6.5L14 21l-4-1z"/>');
const LUNCH_BREAK: IconDef = g('<circle cx="12" cy="13" r="8"/><path d="M12 9v4l3 2"/><path d="M6 4h12"/>');
const MONTHLY_EXPLORER: IconDef = g('<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M8 3v4M16 3v4"/><path d="M8 14h2M14 14h2M8 17h2"/>');
const NIGHT_OWL: IconDef = g('<circle cx="8.5" cy="12" r="4"/><circle cx="16.5" cy="12" r="4"/><circle cx="8.5" cy="12" r="1.4"/><circle cx="16.5" cy="12" r="1.4"/><path d="M12.5 16l-1 4h-4z"/>');
const NOCTURNAL: IconDef = g('<path d="M19.5 13.5A7.5 7.5 0 1 1 10.5 4.5a6 6 0 0 0 9 9z"/><path d="M18 4l.5 1.5L20 6l-1.5.5L18 8l-.5-1.5L16 6l1.5-.5z"/>');
const PINBALL_WIZARD: IconDef = g('<circle cx="12" cy="5" r="2"/><path d="M6 18 12 5l6 13"/><path d="M4 20h16"/><circle cx="9" cy="17" r="1.3"/><circle cx="14" cy="17" r="1.3"/>');
const REPEAT_VISITOR: IconDef = g('<path d="M9 6a7 7 0 0 0-7 7h-0M2 13l3-3 1 3H4a6 6 0 0 1 11-3"/><path d="M15 18a7 7 0 0 0 7-7M22 11l-3 3-1-3h2a6 6 0 0 1-11 3"/>');
const ROAM_MARATHON: IconDef = g('<path d="M4 21 9 5l4 4 7-4"/>');
const SESSION_BEAST: IconDef = g('<circle cx="9" cy="14" r="4"/><circle cx="9" cy="8" r="2.5"/><circle cx="8" cy="7.2" r="1"/><circle cx="10" cy="7.2" r="1"/><path d="M12 9c2 0 4-1 5-3"/><path d="M9 17v4"/>');
const SPEED_DEMON: IconDef = g('<path d="M13 2 4 14h6l-1 8 9-12h-6z"/>');
const SPEED_READER: IconDef = g('<path d="M4 5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/><path d="M13 3l3 4 5-4"/>');
const SUBCATEGORY_SPECIALIST: IconDef = g('<rect x="4" y="4" width="7" height="7"/><rect x="13" y="4" width="7" height="7"/><rect x="4" y="13" width="7" height="7"/><path d="M14 18l2.5 2.5 5-5"/>');
const SUNSET_SEEKER: IconDef = g('<path d="M3 17h18"/><path d="M6 17a6 6 0 0 1 12 0"/><path d="M12 8V5M6.3 10.3 4.8 8.8M17.7 10.3l1.5-1.5"/>');
const THE_WANDERER: IconDef = g('<path d="M6 12c2 0 2-5 4-5s2 5 4 5 2-5 4-5M6 12v7M10 7v6M14 7v6M18 7v6"/>');
const WORLD_TRAVELER: IconDef = g('<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.4 2.5 3.6 5.4 3.6 8.5s-1.2 6-3.6 8.5c-2.4-2.5-3.6-5.4-3.6-8.5S9.6 6 12 3.5z"/><path d="M17.5 5.5 20 3"/>');
// ── collecting ───────────────────────────────────────────────────────────
const CO_ARCHIVIST: IconDef = g('<path d="M6 3h9l5 5v13H6z"/><path d="M15 3v5h5"/><path d="M9 12h6M9 16h6"/>');
const COLLECTOR: IconDef = g('<path d="M6 3h12l4 6-10 12L2 9z"/><path d="M2 9h20"/><path d="M12 21 8 9M12 21l4-12"/>');
const TAGGER: IconDef = g('<path d="M3 12V5a1 1 0 0 1 1-1h7l10 10-8 8-10-10z"/><circle cx="8" cy="8" r="1.5"/>');
const BOOKWORM: IconDef = g('<path d="M12 7c-2-1.5-4-1.5-6-.5v11c2-1 4-1 6 .5 2-1.5 4-1.5 6-.5v-11c-2-1-4-1-6 .5z"/><path d="M12 7v11"/>');
const CO_FILLER: IconDef = g('<rect x="4" y="4" width="8" height="8"/><rect x="12" y="12" width="8" height="8"/>');
const COLLECTORS_COLLECTOR: IconDef = g('<path d="M3 12l9-6 9 6-9 6z"/><path d="M5 15l7 5 7-5"/>');
const COMPLETIONIST: IconDef = g('<circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.5 2.5L16 9"/>');
const CONSISTENT_COLLECTOR: IconDef = g('<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M8 3v4M16 3v4"/><path d="M10 15l2 2 4-4"/>');
const DOMAIN_COLLECTOR: IconDef = g('<circle cx="12" cy="12" r="8"/><path d="M12 4v16M4 12h16"/><path d="M6.5 6.5c3.5 3.5 7.5 3.5 11 0M6.5 17.5c3.5-3.5 7.5-3.5 11 0"/>');
const EARLY_BIRD_COLLECTOR: IconDef = g('<path d="M5 18h14"/><circle cx="8" cy="12" r="3"/><path d="M10.8 11l2.7-1.5M10.8 13l2.7 1.5"/><path d="M16 8h3v3h-3z"/>');
const EMERGENCY_FUND: IconDef = g('<rect x="5" y="9" width="14" height="11" rx="2"/><circle cx="12" cy="14.5" r="3"/><path d="M12 11.5v-1M12 17v1M9 14.5h6"/>');
const FIRST_SAVE: IconDef = g('<path d="M6 4h12v16l-6-4-6 4z"/>');
const HOARDER: IconDef = g('<rect x="5" y="6" width="10" height="6" rx="1"/><rect x="9" y="12" width="10" height="6" rx="1"/>');
const HOARDER_STRIKES_BACK: IconDef = g('<rect x="4" y="13" width="7" height="8"/><rect x="12" y="13" width="8" height="8"/><rect x="8" y="8" width="8" height="8"/>');
const LANGUAGE_COLLECTOR: IconDef = g('<path d="M7 17l5-11 5 11"/><path d="M8.5 13h7"/><path d="M4 5h2M12 4h2M19 5h2"/>');
const LONG_TERM_STORAGE: IconDef = g('<rect x="4" y="8" width="16" height="12" rx="1.5"/><path d="M4 8V6a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v2"/><path d="M4 8h16"/><path d="M10 13h4"/>');
const MEGA_COLLECTOR: IconDef = g('<path d="M12 3l9 5v8l-9 5-9-5V8z"/><path d="M12 3v10M12 13l9-5M12 13l-9-5M3 8l9 5 9-5"/>');
const MEGA_COLLECTION: IconDef = g('<path d="M8 4l3 4-3 4-3-4z"/><path d="M16 12l3 4-3 4-3-4z"/>');
const MINIMALIST: IconDef = g('<circle cx="12" cy="12" r="2"/>');
const ONE_STOP_SHOP: IconDef = g('<path d="M4 9l2-6h12l2 6"/><path d="M4 9h16v12H4z"/><path d="M9 21v-7h6v7"/>');
const PACK_MULE: IconDef = g('<path d="M7 9h10a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2z"/><path d="M9 9V6a3 3 0 0 1 6 0v3M12 12v6"/>');
const POCKET_FILLER: IconDef = g('<path d="M3 8h14a3 3 0 0 1 3 3v7a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3z"/><path d="M17 11h4v3h-4"/><circle cx="9" cy="14.5" r="1.5"/>');
const QUICK_SAVE: IconDef = g('<path d="M6 4h12v16l-6-4-6 4z"/><path d="M13 7l-3 4h2.5L12 16l3.5-5H13z"/>');
const SAVE_STREAK: IconDef = g('<path d="M5 4h4v10l-2-1.5L5 14z"/><path d="M10 4h4v10l-2-1.5L10 14z"/><path d="M15 4h4v10l-2-1.5L15 14z"/>');
const SAVE_WAVE: IconDef = g('<path d="M3 14c2.5-3 4.5-3 7 0s4.5 3 7 0"/><path d="M3 19c2.5-3 4.5-3 7 0s4.5 3 7 0"/>');
const SPEED_COLLECTOR: IconDef = g('<path d="M3 6l9-4 9 4-9 4z"/><path d="M13 11l-4 5h3l-1 5 5-7h-3z"/>');
const TAG_MASTER: IconDef = g('<path d="M3 12V4h8l10 10-8 8-10-10z"/><path d="M8 10l2 2 4-4"/>');
const UN_SAVER: IconDef = g('<path d="M6 4h12v16l-6-4-6 4z"/><path d="M4 4l16 16"/>');
const WEEKEND_HOARDER: IconDef = g('<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M8 3v4M16 3v4"/><path d="M8 14h2v2H8zM14 14h2v2h-2z"/>');
const WEEKLY_COLLECTOR: IconDef = g('<rect x="6" y="12" width="5" height="8"/><rect x="9.5" y="7" width="5" height="8"/><rect x="13" y="2" width="5" height="8"/>');
const YEAR_OLD: IconDef = g('<path d="M5 18h14"/><path d="M6 18c0-6 3-8 6-8s6 2 6 8z"/><path d="M12 6V3M12 3s-2 1.5-2 .6M12 3s2 1.5 2 .6"/>');
// ── curating ─────────────────────────────────────────────────────────────
const CURATOR: IconDef = g('<path d="M4 5h16l-6 7v6l-4 2v-8z"/>');
const FAVORITED: IconDef = g('<path d="M12 20s-7-4.4-7-9.1A3.9 3.9 0 0 1 12 7.6a3.9 3.9 0 0 1 7 3.3C19 15.6 12 20 12 20z"/>');
const PACK_RAT: IconDef = g('<path d="M4 9l8-4 8 4v7l-8 4-8-4z"/><path d="M8 7v9.5M12 8.5V13M16 7v9.5"/>');
const AWARD_WINNER: IconDef = g('<path d="M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M7 5H4a3 3 0 0 0 3 5M17 5h3a3 3 0 0 1-3 5"/><path d="M12 14v4M8 21h8M10 18h4"/>');
const COLLECTION_REMIX: IconDef = g('<path d="M4 7h13M15 4l3 3-3 3"/><path d="M20 17H7M9 14l-3 3 3 3"/>');
const COLLECTION_STREAK: IconDef = g('<path d="M6 14l6-6 6 6"/><path d="M6 20l6-6 6 6"/>');
const CURATOR_SUPREME: IconDef = g('<path d="M3 8l4 3 5-6 5 6 4-3-2 11H5z"/>');
const CURATORS_BLOCK: IconDef = g('<path d="M4 20h16"/><path d="M5 15l10-10 4 4-10 10z"/><path d="M12 8l4 4"/><path d="M17 17l4 0"/>');
const CURATORS_EYE: IconDef = g('<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2.5"/><path d="M18 6l.6 1.4L20 8l-1.4.6L18 10l-.6-1.4L16 8l1.4-.6z"/>');
const CURATORS_PICK: IconDef = g('<path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 5.9-5.3-3-5.3 3 1.2-5.9L3.4 9.3l6-.7z"/>');
const DAILY_CURATION: IconDef = g('<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M8 3v4M16 3v4"/><path d="M14 16l-3 3-1.5-1.5"/>');
const DESCRIPTIVIST: IconDef = g('<path d="M4 6h16M4 11h16M4 16h9"/>');
const DIVERSE_COLLECTIONS: IconDef = g('<rect x="4" y="13" width="6" height="6"/><circle cx="15" cy="16" r="3"/><path d="M15 7l4-3v6z"/>');
const FIRST_COLLECTION: IconDef = g('<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>');
const HIDDEN_GEM: IconDef = g('<path d="M6 4h12l4 6-10 11L2 10z"/><path d="M2 10h20M12 21 8.5 10M12 21l3.5-11"/><path d="M12 7l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z"/>');
const LINKER: IconDef = g('<path d="M9 15l6-6"/><path d="M5 15a3 3 0 0 0 3 3h1a3 3 0 0 0 0-6H8a3 3 0 0 1 0-6h1a3 3 0 0 1 3 3"/><path d="M19 9a3 3 0 0 0-3-3h-1a3 3 0 0 0 0 6h1a3 3 0 0 1 0 6h-1a3 3 0 0 1-3-3"/>');
const MEGA_SHARE: IconDef = g('<circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="M8.4 10.8l7.2-3.6M8.4 13.2l7.2 3.6"/>');
const MICRO_CURATOR: IconDef = g('<rect x="6" y="6" width="12" height="12" rx="1.5"/><path d="M9 12h6M12 9v6"/>');
const NICHED_DOWN: IconDef = g('<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="1"/>');
const PUBLIC_CURATOR: IconDef = g('<circle cx="12" cy="12" r="8"/><path d="M4 12h16M12 4c2.4 2.4 3.6 5.2 3.6 8s-1.2 5.6-3.6 8c-2.4-2.4-3.6-5.2-3.6-8S9.6 6.4 12 4z"/><path d="M15.5 15.5L18 18"/>');
const RECYCLER: IconDef = g('<path d="M12 5l3 2-2.6 1M20 11l-2 3-2.6-1"/><path d="M18.5 17.5l-1.5 3.5-3.6-.5"/><path d="M5.5 17.5l1.5 3.5 3.6-.5"/><path d="M4 11l2 3 2.6-1"/>');
const REFINED_TASTE: IconDef = g('<path d="M5 4h14M8 4v6a4 4 0 0 0 8 0V4"/><path d="M12 14v6M8 20h8"/>');
const SOLO_ARTIST: IconDef = g('<circle cx="12" cy="8" r="4"/><path d="M6 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/>');
const THEMATIC: IconDef = g('<circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 0 0 18z"/><circle cx="9" cy="8" r="1.3"/><circle cx="15" cy="9" r="1.3"/><circle cx="9" cy="16" r="1.3"/><circle cx="14" cy="15" r="1.3"/>');
const THEME_MASTER: IconDef = g('<path d="M12 4l9 5-9 5-9-5z"/><path d="M12 9l9 5-9 5-9-5z"/>');
const WEEKLY_PUBLISHER: IconDef = g('<path d="M3 11l18-8-6 18-3-7z"/><path d="M21 3L8 11"/>');
// ── social ────────────────────────────────────────────────────────────────
const INFLUENCER: IconDef = g('<path d="M4 10v4l5 3V7z"/><path d="M9 12.5 12 16l8-4"/><path d="M17 8c1.5 0 2.5 1.5 2.5 3S18.5 14 17 14"/>');
const SOCIAL_BUTTERFLY: IconDef = g('<path d="M12 8c-3-3-7-3-8 0 1 .5 2 2 2 3 1 1 2 1 3 0"/><path d="M12 8c3-3 7-3 8 0-1 .5-2 2-2 3-1 1-2 1-3 0"/><path d="M12 8v8"/><path d="M10 14c0-1.5 1-2.5 2-2.5s2 1 2 2.5"/>');
const VIRAL: IconDef = g('<path d="M3 17l6-6 4 3 7-8"/><path d="M15 6h5v5"/>');
const BELOVED: IconDef = g('<path d="M12 20s-7-4.4-7-9.1A3.9 3.9 0 0 1 12 7.6a3.9 3.9 0 0 1 7 3.3C19 15.6 12 20 12 20z"/><path d="M17 5l.5 1.2L19 6.5l-1.5.4L17 8l-.4-1.1L15 6.5l1.6-.3z"/>');
const BIO_HACKER: IconDef = g('<path d="M7 4c0 5 10 5 10 8s-10 3-10 8"/><path d="M17 4c0 5-10 5-10 8s10 3 10 8"/><path d="M7 6h2M7 18h2M15 6h2M15 18h2"/>');
const BIRTHDAY_BUDDY: IconDef = g('<path d="M12 4a3 3 0 0 1 3 3c0 2-1.5 3-3 3s-3-1-3-3a3 3 0 0 1 3-3z"/><path d="M12 10v4M9 21h6l-1-7H10z"/>');
const BROADCASTER: IconDef = g('<path d="M12 8v13M6 21h12"/><path d="M8.5 8a7 7 0 0 1 7 0"/><path d="M6 6a12 12 0 0 1 12 0"/>');
const CELEBRITY: IconDef = g('<path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 5.9-5.3-3-5.3 3 1.2-5.9L3.4 9.3l6-.7z"/><path d="M19 14l.5 1.4L21 16l-1.5.5L19 18l-.5-1.5L17 16l1.5-.5z"/>');
const CHATTERBOX: IconDef = g('<path d="M4 6h13v9H8l-4 3z"/><path d="M16 11h4v6l-3 2v-2.5"/>');
const CONNECTOR: IconDef = g('<path d="M9 7h6a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z"/><path d="M9 7V4h3M9 17v3h3"/>');
const FAN_CLUB: IconDef = g('<circle cx="9" cy="9" r="3"/><circle cx="17" cy="9" r="3"/><path d="M4 20c0-3 2.2-5 5-5h0M15 15c2.8 0 5 2 5 5"/>');
const FIRST_FOLLOWER: IconDef = g('<circle cx="9" cy="8" r="3.5"/><path d="M3.5 20c0-3.3 2.5-6 5.5-6s5.5 2.7 5.5 6"/><path d="M17 9v6M14 12h6"/>');
const FIRST_SHARE: IconDef = g('<path d="M12 15V3M8 7l4-4 4 4"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/>');
const FOLLOW_BACK: IconDef = g('<circle cx="12" cy="12" r="8"/><path d="M9 11a3 3 0 0 1 6 0M12 8a3 3 0 0 0-6 0M12 16a3 3 0 0 0 6 0M15 13a3 3 0 0 1-6 0"/>');
const FOLLOW_FRENZY: IconDef = g('<circle cx="7" cy="7" r="3"/><path d="M2 18c0-3 2-5 5-5s5 2 5 5"/><path d="M15 3v6M12 6h6"/><path d="M17 13v6M14 16h6"/>');
const FOLLOWER_50: IconDef = g('<circle cx="9" cy="8" r="3.5"/><path d="M3.5 20c0-3.3 2.5-6 5.5-6s5.5 2.7 5.5 6"/><path d="M19 11l1.5 3 3 .4-2.2 2 .5 3-2.8-1.5L16.2 16.4l.5-3-2.2-2 3-.4z"/>');
const FRIENDLY_FACE: IconDef = g('<circle cx="12" cy="12" r="9"/><path d="M8 14c1 1.5 2.5 2 4 2s3-.5 4-2"/><circle cx="9" cy="9.5" r="1"/><circle cx="15" cy="9.5" r="1"/>');
const FULL_PROFILE: IconDef = g('<rect x="4" y="4" width="16" height="16" rx="2"/><circle cx="9" cy="9" r="2"/><path d="M5 17c0-2.2 1.8-4 4-4s4 1.8 4 4"/><path d="M15 8h4M15 12h4"/>');
const INNER_CIRCLE: IconDef = g('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4.5"/><path d="M10.5 12l1.2 1.2L14 10.5"/>');
const LINK_IN_BIO: IconDef = g('<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M9 15l6-6"/><path d="M7 11.5a2.5 2.5 0 0 1 0-3.5l1-1M17 12.5a2.5 2.5 0 0 1 0 3.5l-1 1"/>');
const MUTUAL_ADMIRATION: IconDef = g('<path d="M8 9l-3 3 3 3M16 9l3 3-3 3"/>');
const NAME_DROPPER: IconDef = g('<circle cx="12" cy="12" r="7"/><path d="M16 16v.5a2.5 2.5 0 0 1-5 0c0-4 3-5.5 5-8a3.5 3.5 0 0 0-7 0"/>');
const PROFILE_PERFECTIONIST: IconDef = g('<circle cx="12" cy="12" r="9"/><circle cx="9" cy="9" r="2"/><path d="M5.5 16c0-2.2 1.6-3.6 3.5-3.6s3.5 1.4 3.5 3.6"/><path d="M16 15l1.5 1.5L19.5 13"/>');
const PROFILE_PIC: IconDef = g('<path d="M3 8h4l1.5-2h5L15 8h5a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13.5" r="3.5"/>');
const PUBLIC_FIGURE: IconDef = g('<circle cx="12" cy="12" r="8"/><path d="M12 7l1.5 3 3 .4-2.2 2 .5 3-2.8-1.5L9.2 15.4l.5-3-2.2-2 3-.4z"/>');
const SHARE_HAPPY_HOUR: IconDef = g('<circle cx="10" cy="13" r="7"/><path d="M10 9v4l3 2"/><path d="M16 5l3 3-3 3M13.5 8H19"/>');
const SOCIAL_NETWORK: IconDef = g('<circle cx="5" cy="17" r="2.5"/><circle cx="17" cy="17" r="2.5"/><circle cx="11" cy="7" r="2.5"/><path d="M6.5 15.5l3-7M14.5 15.5l-2-7"/>');
const THE_LURKER: IconDef = g('<circle cx="12" cy="12" r="7.5"/><circle cx="12" cy="12" r="2.8"/><path d="M2.5 5.5 5 8M21.5 5.5 19 8"/>');
const TWO_WAY_STREET: IconDef = g('<path d="M4 8h16M13 5l3 3-3 3"/><path d="M20 16H4M11 13l-3 3 3 3"/>');
const VERIFIED_ROAMER: IconDef = g('<path d="M12 3l2 2 3-1 1 3 3 1-1 3 1 3-3 1-1 3-3-1-2 2-2-2-3 1-1-3-3-1 1-3-1-3 3-1 1-3z"/><path d="M9 12l2 2 4-4"/>');
// ── streaks ───────────────────────────────────────────────────────────────
const HOT_STREAK: IconDef = g('<path d="M12 3s5 4.6 5 9a5 5 0 0 1-10 0c0-1.4.5-2.7 1.3-3.8C8.8 9.4 9.3 10.6 10 11c.1-2.6 1-4.8 2-8z"/><path d="M6 20h2M16 20h2"/>');
const CONSISTENCY_KING: IconDef = g('<circle cx="12" cy="13" r="6"/><path d="M12 19l-1.5 3h3zM9 8l.5-3h5l.5 3"/><path d="M10 13l1.5 1.5L15 11.5"/>');
const DOUBLE_DIGITS: IconDef = g('<path d="M7 8v8M7 8h2.5M8.2 8v8"/><path d="M14 8h4a3 3 0 1 1 0 8h-4z"/>');
const EARLY_RISER_STREAK: IconDef = g('<path d="M3 17h18"/><path d="M7 17a5 5 0 0 1 10 0"/><path d="M12 3s4 4 4 7a4 4 0 0 1-8 0c0-2.5 4-7 4-7z"/>');
const FULL_YEAR: IconDef = g('<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5v17M3.5 12h17"/>');
const HALF_YEAR_HERO: IconDef = g('<circle cx="12" cy="12" r="9"/><path d="M3 12a9 9 0 0 0 18 0z"/>');
const NIGHT_OWL_STREAK: IconDef = g('<path d="M19 14A8 8 0 1 1 10 5a6.5 6.5 0 0 0 9 9z"/><path d="M6 20h4"/>');
const PHOENIX: IconDef = g('<path d="M12 21V9"/><path d="M12 9c-2 0-3.5-1.5-4-4 1.5 1.5 3 1.5 4 .5"/><path d="M12 9c2 0 3.5-1.5 4-4-1.5 1.5-3 1.5-4 .5"/><path d="M8 21h8"/>');
const SEASONED: IconDef = g('<path d="M5 19C5 9 11 5 20 4c-1 9-5 15-15 15z"/><path d="M5 19C9 13 13 9 20 6"/>');
const THE_MARATHON: IconDef = g('<path d="M4 21 8 7l6 8 6-12"/><path d="M2 21h20"/>');
const TWENTY_ONE: IconDef = g('<path d="M7 8a3 3 0 1 1 0 6l3-3h-3"/><path d="M15 8v8M15 8h3"/>');
const UNSTOPPABLE: IconDef = g('<path d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6z"/><path d="M9 12l2 2 4-4"/>');
const WEEKEND_STREAK: IconDef = g('<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M8 3v4M16 3v4"/><path d="M8 14l1.5 1.5L13 12M15 14v3M13.5 15.5h3"/>');
// ── contributing ─────────────────────────────────────────────────────────
const APPROVED: IconDef = g('<path d="M4 12.5l5 5L20 7"/>');
const CONTRIBUTOR: IconDef = g('<path d="M12 5v14M5 12h14"/>');
const CLUB_100: IconDef = g('<path d="M5 8v8M5 8h2"/><path d="M11 8h3.5a3 3 0 1 1 0 8H11z"/><path d="M17.5 8H21a3 3 0 1 1 0 8h-3.5z"/>');
const APPROVAL_STREAK: IconDef = g('<path d="M4 12.5l5 5 11-12"/><path d="M4 20h3M13 20h3"/>');
const THE_ARCHIVIST: IconDef = g('<path d="M5 4h14v16H5z"/><path d="M8 8h8M8 12h8M8 16h5"/>');
const CATEGORY_FILLER: IconDef = g('<rect x="4" y="4" width="8" height="8"/><rect x="12" y="12" width="8" height="8"/><path d="M6.5 8l1.5 1.5L9.5 8"/>');
const CITIZEN_JOURNALIST: IconDef = g('<rect x="4" y="5" width="16" height="16" rx="1.5"/><path d="M4 9h16"/><path d="M7 12h6M7 15h4M13.5 12h3.5M14.5 15h2.5"/>');
const COMMUNITY_BUILDER: IconDef = g('<circle cx="8" cy="8" r="2.5"/><circle cx="16" cy="8" r="2.5"/><path d="M3 19c0-3 2-5 5-5"/><path d="M16 14c3 0 5 2 5 5"/><path d="M12 4v4M10 6h4"/>');
const CONTRIBUTOR_PLATINUM: IconDef = g('<path d="M12 5v14M5 12h14"/><path d="M18.5 4.5l.5 1.2L20 6l-1 .4L18.5 7.5l-.4-1.1L17 6l1.5-.3z"/>');
const FAST_TRACK: IconDef = g('<path d="M5 8l6 4-6 4"/><path d="M13 8l6 4-6 4"/>');
const FIRST_SUBMISSION: IconDef = g('<path d="M4 13h16l-1 7H5z"/><path d="M4 13l3-6h10l3 6"/><path d="M12 4v3"/>');
const GLOBAL_CONTRIBUTOR: IconDef = g('<circle cx="10" cy="10" r="7"/><path d="M3 10h14M10 3c2.3 2.2 3.4 4.7 3.4 7"/><path d="M19 6h4M21 4v4"/>');
const NIGHT_OWL_SUBMITTER: IconDef = g('<path d="M19 14A8 8 0 1 1 10 5a6.5 6.5 0 0 0 9 9z"/><path d="M15 15l5 5M16 20v-4"/>');
const PIONEER: IconDef = g('<path d="M5 21V3"/><path d="M5 4c4 2 8-2 12 0-4 2-8 6-12 4"/>');
const PROLIFIC: IconDef = g('<path d="M4 5h16M4 10h16M4 15h10"/><path d="M16 12v6M13 15h6"/>');
const QUALITY_CONTROL: IconDef = g('<circle cx="11" cy="11" r="6"/><path d="M15.5 15.5L20 20"/><path d="M8 11l2 2 4-4"/>');
const QUALITY_FIRST: IconDef = g('<circle cx="12" cy="12" r="8"/><path d="M12 7v10M12 7l-2.5 2M12 7l2.5 2"/>');
const SPEED_SUBMITTER: IconDef = g('<path d="M13 3 6 12h4l-1 6 6-9h-4z"/><path d="M17 3h4v4"/>');
const SUBCATEGORY_SCOUT: IconDef = g('<circle cx="8" cy="12" r="3.5"/><circle cx="16" cy="12" r="3.5"/><path d="M4 13l-1 7h4M20 13l1 7h-4"/>');
const SUBMISSION_STREAK: IconDef = g('<path d="M4 12h16l-1 7H5z"/><path d="M4 12l3-6h10l3 6"/><path d="M6 3h3M15 3h3"/>');
const TOP_CONTRIBUTOR: IconDef = g('<path d="M3 19h18"/><path d="M4 19v-6h4v6M10 19V8h4v11M16 19v-4h4v4"/>');
const VARIETY_SUBMITTER: IconDef = g('<rect x="4" y="4" width="5" height="5"/><circle cx="17" cy="17" r="2.5"/><path d="M9 15l5-6 4 4"/>');
const WEEKDAY_WARRIOR: IconDef = g('<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M8 3v4M16 3v4"/><path d="M7 14h10M7 17h7"/>');
const WEEKEND_SUBMITTER: IconDef = g('<path d="M4 13h16l-1 7H5z"/><path d="M4 13l3-6h10l3 6"/><path d="M7 7h2v2H7zM15 7h2v2h-2z"/>');
// ── curiosity ─────────────────────────────────────────────────────────────
const ROLL_RATE_5: IconDef = g('<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M12 8l1.5 3 3 .4-2.2 2 .5 3-2.8-1.5L9.2 16.4l.5-3-2.2-2 3-.4z"/>');
const ROLL_WALLPAPER: IconDef = g('<rect x="4" y="4" width="16" height="16" rx="1"/><circle cx="9" cy="9" r="2"/><path d="M6 17l5-6 3 3 3-3 2 2"/>');
const WEEKLY_CHALLENGE_WARRIOR: IconDef = g('<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M8 3v4M16 3v4"/><path d="M10 16l2-2 2 2M12 14v3"/>');
// ── engagement ─────────────────────────────────────────────────────────────
const RATER: IconDef = g('<path d="M3 10h4v11H3z"/><path d="M7 10l4-6v6h3a3 3 0 0 1 3 3v2a3 3 0 0 1-3 3h-2l-2 3H9"/>');
const CHALLENGE_ACCEPTED: IconDef = g('<path d="M6 3v18"/><path d="M6 4h6l-2 3 2 3H6z"/><path d="M6 13h6l-2 3 2 3H6z"/>');
const CHALLENGE_ADDICT: IconDef = g('<path d="M9 15l6-6"/><path d="M5 15a3 3 0 0 0 3 3h1a3 3 0 0 0 0-6H8a3 3 0 0 1 0-6h1a3 3 0 0 1 3 3"/><path d="M17 4h4v4"/>');
const CHALLENGE_HOARDER: IconDef = g('<path d="M5 21V4"/><path d="M5 4h14v4H5"/><path d="M9 21V10"/><path d="M9 10h11v4H9"/>');
const CHALLENGE_MASTER: IconDef = g('<path d="M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M12 13v4M8 21h8M10 18h4"/><path d="M17 3l.6 1.4L19 5l-1.4.6L17 7l-.6-1.4L15 5l1.4-.6z"/>');
const CRITIC: IconDef = g('<path d="M4 5h16v12H9l-5 3z"/><path d="M12 8v4M12 15h.01"/>');
const DAILY_DEVOTION: IconDef = g('<path d="M12 20s-7-4.4-7-9.1A3.9 3.9 0 0 1 12 7.6a3.9 3.9 0 0 1 7 3.3C19 15.6 12 20 12 20z"/><path d="M8 5l3.5.2.5 4L9.5 11"/>');
const DAILY_DRIVER: IconDef = g('<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="2.5"/><path d="M12 4v5M12 15v5M4 12h5M15 12h5"/>');
const DAILY_DYNAMO: IconDef = g('<circle cx="12" cy="12" r="8"/><path d="M13 7l-4 6h3l-1 5 5-7h-3z"/>');
const DAILY_ROUTINE: IconDef = g('<circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/><path d="M5 5l2 2M19 5l-2 2M5 19l2-2M19 19l-2-2"/>');
const DEEP_READER: IconDef = g('<path d="M4 5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/><path d="M12 3v18"/>');
const DIVERSITY_CHAMP: IconDef = g('<path d="M5 19a7 7 0 0 1 14 0z"/><path d="M9 19a3 3 0 0 1 6 0"/>');
const DOWNER: IconDef = g('<path d="M21 14h-4l-4 6V4a1 1 0 0 1 1-1h4a3 3 0 0 1 3 3z"/><path d="M3 4v11h4"/>');
const FEEDBACK_LOOP: IconDef = g('<path d="M4 6h13v8H8l-4 3z"/><path d="M16 11a4 4 0 1 0 1 3M19 9h-2"/>');
const FIRST_CHALLENGE: IconDef = g('<path d="M6 21V3h10l-2.5 3 2.5 3H6z"/>');
const JANUARY_GRIND: IconDef = g('<path d="M12 3v18M5 12h14M7 7l10 10M17 7L7 17"/>');
const LAST_MINUTE_SAVE: IconDef = g('<circle cx="12" cy="13" r="7"/><path d="M12 9v4l3 2"/><path d="M6 3l2 2M18 3l-2 2"/>');
const LOYALIST: IconDef = g('<path d="M12 20s-7-4.4-7-9.1A3.9 3.9 0 0 1 12 7.6a3.9 3.9 0 0 1 7 3.3C19 15.6 12 20 12 20z"/><path d="M9 11.2l1.6 1.6L14 10.5"/>');
const MARATHON: IconDef = g('<path d="M6 21V4"/><path d="M6 4h9l-2.5 3L10 10H6z"/><circle cx="17" cy="15" r="5"/><path d="M17 13v2l1.5 1"/>');
const MONTHLY_MASTERY: IconDef = g('<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M8 3v4M16 3v4"/><path d="M12 13l1.3 2.6 3 .4-2.2 2 .5 3-2.6-1.4-2.6 1.4.5-3-2.2-2 3-.4z"/>');
const MONTHLY_MOGUL: IconDef = g('<circle cx="9" cy="6" r="3"/><circle cx="15" cy="6" r="3"/><circle cx="12" cy="10" r="3"/><circle cx="9" cy="14" r="3"/><circle cx="15" cy="14" r="3"/><circle cx="12" cy="18" r="3"/>');
const MORNING_RATER: IconDef = g('<path d="M3 17h18"/><path d="M7 17a5 5 0 0 1 10 0"/><path d="M19 6l.7 1.6 1.6.7-1.6.7L19 10.5l-.7-1.5-1.6-.7 1.6-.7z"/>');
const NON_COMMITTAL: IconDef = g('<circle cx="12" cy="9" r="3"/><path d="M6 17c0-3.3 2.7-6 6-6s6 2.7 6 6"/><path d="M6 6l-.5-2M6 6l-2 .5"/><path d="M18 6l.5-2M18 6l2 .5"/>');
const OMNIVORE: IconDef = g('<path d="M7 4v18M7 4a2.5 2.5 0 0 0-2.5 2.5V11c0 4 2.5 5 2.5 5"/><path d="M16 4v18M16 8a2.5 2.5 0 0 0 3-2.5V4"/>');
const OVERACHIEVER: IconDef = g('<circle cx="12" cy="12" r="8"/><path d="M8 13l4-4 4 4M12 9v8"/>');
const PERFECT_MONTH: IconDef = g('<path d="M6 3h12l4 6-10 12L2 9z"/><path d="M9 10l2.5 2.5L16 9"/>');
const PERFECT_WEEK: IconDef = g('<circle cx="12" cy="12" r="7"/><path d="M12 8l1.3 2.6 3 .4-2.2 2 .5 3-2.6-1.4-2.6 1.4.5-3-2.2-2 3-.4z"/>');
const POWER_USER: IconDef = g('<path d="M12 4v6"/><path d="M17.7 7A8 8 0 1 0 17.7 17"/>');
const RATE_BY_CATEGORY: IconDef = g('<path d="M4 6h16M4 11h10M4 16h9"/><path d="M16 17l1.3 2.6 3 .4-2.2 2 .5 3-2.6-1.4-2.6 1.4.5-3-2.2-2 3-.4z"/>');
const RATE_EVERYTHING: IconDef = g('<path d="M5 6l1.5 1.5L9 5M5 18l1.5 1.5L9 17M14 5l2 2 3.5-3.5M14 18l2 2 3.5-3.5"/>');
const RATE_SPREE: IconDef = g('<path d="M9 12l1.3 2.6 3 .4-2.2 2 .5 3-2.6-1.4-2.6 1.4.5-3-2.2-2 3-.4z"/><path d="M17 4l1 2 2.2.3-1.6 1.5.4 2.2-2-1-2 1 .4-2.2-1.6-1.5 2.2-.3z"/><path d="M5 4l.8 1.6 1.7.2-1.2 1.2.3 1.7-1.5-.8-1.5.8.3-1.7-1.2-1.2 1.7-.2z"/>');
const RATE_STREAK: IconDef = g('<path d="M6 16l1.5-3 1.5 3M12 18l2-4 2 4"/>');
const SESSION_BEAST_ENGAGEMENT: IconDef = g('<path d="M13 3c3 2 4 5 4 8l-2 2-2-1-2 6H8l2-6-3-2 1.5-3c2-1 4.5-1 5.5-1z"/><path d="M10 10h4"/>');
const SESSION_SURFER: IconDef = g('<path d="M4 14c3-3 5-3 8 0s5 3 8 0"/><path d="M7 9c3 0 9 4 13 4"/>');
const SPEED_CHALLENGER: IconDef = g('<path d="M13 3 6 12h4l-1 6 6-9h-4z"/><path d="M5 3v18"/>');
const STREAK_CHALLENGER: IconDef = g('<path d="M12 3s5 4.6 5 9a5 5 0 0 1-10 0c0-1.4.5-2.7 1.3-3.8C8.8 9.4 9.3 10.6 10 11c.1-2.6 1-4.8 2-8z"/><path d="M5 19l2.5 2.5L12 17"/>');
const THE_COMPLETIONIST_RATE: IconDef = g('<circle cx="12" cy="12" r="8"/><path d="M8 12.5l3 3L17 9"/><path d="M16.5 16.5l1.5 2M19 15.5l1 2"/>');
const THE_EQUALIZER: IconDef = g('<path d="M7 21V13M12 21V6M17 21v-9"/><circle cx="7" cy="11" r="1.2"/><circle cx="12" cy="4" r="1.2"/><circle cx="17" cy="10" r="1.2"/>');
const THE_JUDGE: IconDef = g('<path d="M12 4v8"/><path d="M5 12h14"/><path d="M7 12l-3 2a2.5 2.5 0 0 0 5 0z"/><path d="M17 12l-3 2a2.5 2.5 0 0 0 5 0z"/>');
const TRIPLE_THREAT: IconDef = g('<path d="M7 19l5-5 5 5"/><path d="M7 12l5-5 5 5"/><path d="M7 5l5-5"/>');
const VOTING_POWER: IconDef = g('<circle cx="12" cy="12" r="8"/><path d="M8 12l2.8 2.8L16 9.5"/><path d="M16 16l2 2"/>');
const WEEKEND_WARRIOR: IconDef = g('<path d="M4 6h16M6 6v12M18 6v12"/><path d="M9 3h6l-3 3z"/><circle cx="12" cy="15" r="2"/>');
const WEEKLY_CHAMPION: IconDef = g('<path d="M12 3l2.5 5.2 5.7.7-4.2 3.8 1.1 5.6-5.1-2.8-5.1 2.8 1.1-5.6L3.8 8.9l5.7-.7z"/><path d="M9 16l2 2 4-4"/>');
const WEEKLY_LEGEND: IconDef = g('<path d="M12 3l2.5 5.2 5.7.7-4.2 3.8 1.1 5.6-5.1-2.8-5.1 2.8 1.1-5.6L3.8 8.9l5.7-.7z"/><path d="M4 4l2 2M20 4l-2 2"/>');
const WEEKLY_WARRIOR: IconDef = g('<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M8 3v4M16 3v4"/><path d="M8 13l1.5 1.5L12 12M14 13l2.5 2.5L21 12"/>');
const WELL_ROUNDED: IconDef = g('<circle cx="12" cy="12" r="8"/><circle cx="9" cy="10" r="1.2"/><circle cx="15" cy="10" r="1.2"/><path d="M8 15c1 1.3 2.5 2 4 2s3-.7 4-2"/>');
// ── games ─────────────────────────────────────────────────────────────────
const GAMER_FIRST: IconDef = g('<path d="M7 7h10a3 3 0 0 1 3 3v5a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3v-5a3 3 0 0 1 3-3z"/><path d="M8 10v5M6 12.5h4"/><circle cx="16.5" cy="11" r="1"/><circle cx="18.5" cy="13.5" r="1"/>');
const GAMER_3: IconDef = g('<rect x="3" y="8" width="6" height="8" rx="1.5"/><rect x="9" y="8" width="6" height="8" rx="1.5"/><rect x="15" y="8" width="6" height="8" rx="1.5"/>');
const GAMER_ALL: IconDef = g('<rect x="5" y="4" width="14" height="16" rx="1.5"/><path d="M8 8l4-2 4 2-4 2z"/><circle cx="12" cy="12" r="1.2"/><circle cx="8" cy="16" r="1.2"/><circle cx="16" cy="16" r="1.2"/>');
const COMPILER_LVL_25: IconDef = g('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 9l3 3-3 3M13 15h5"/>');
const WIN_COMPILER: IconDef = g('<path d="M5 4h14v16H5z"/><path d="M8 12l3 3 6-7"/>');
const RELAY_LVL_25: IconDef = g('<path d="M4 12h16"/><path d="M4 12l3-3M4 12l3 3M20 12l-3-3M20 12l-3 3"/><circle cx="12" cy="12" r="1.5"/>');
const WIN_RELAY: IconDef = g('<path d="M2.5 9a13 13 0 0 1 19 0"/><path d="M5.5 12.5a8.5 8.5 0 0 1 13 0"/><path d="M8.5 16a4 4 0 0 1 7 0"/><circle cx="12" cy="19.5" r="1"/>');
const HIGH_SCORE_500: IconDef = g('<path d="M4 20h16"/><path d="M7 20v-8M12 20V6M18 20v-11"/><path d="M6 12H3M14 8h3"/>');
const HIGH_SCORE_1000: IconDef = g('<path d="M4 20h16"/><path d="M7 20v-6M12 20v-13M17 20V8"/><path d="M16 7l1.5 1.5L20 6"/>');
const WIN_BOTFIELD: IconDef = g('<rect x="4" y="4" width="16" height="16" rx="1"/><path d="M8 12.5l2.5 2.5L16 9"/>');
const WIN_DEBRIS: IconDef = g('<path d="M12 12 18 4"/><circle cx="12" cy="12" r="8"/><path d="M12 4v16M4 12h16"/>');
const WIN_FIREWALK: IconDef = g('<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M12 6s4 4 4 7.5a4 4 0 0 1-8 0C8 10 12 6 12 6z"/>');
const WIN_SUBSTRATE: IconDef = g('<path d="M3 9h18l-2 12H5z"/><path d="M3 9a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2"/><path d="M12 11v3M9 12.5h6"/>');
const WIN_UNDERWEB: IconDef = g('<path d="M6 14l2.5-3 2.5 3-2.5 3z"/><path d="M11 11l2.5-3 2.5 3-2.5 3z"/><path d="M16 8l2.5-3 2.5 3-2.5 3z"/>');
// ── secret ────────────────────────────────────────────────────────────────
const CENTURY_ROAM: IconDef = g('<circle cx="12" cy="12" r="8"/><path d="M15 9a4 4 0 1 0 0 6"/>');
const CHINA_NATIONAL_DAY: IconDef = g('<path d="M9 3h6l4 6H5z"/><path d="M7 9v3h10V9"/><path d="M8 16h8M12 12v4"/>');
const CHRISTMAS_DAY: IconDef = g('<path d="M12 3l4 6-2.5 4L16 18H8l2.5-5L8 9z"/><path d="M3 18h18M8 21h8"/>');
const CINCO_DE_MAYO: IconDef = g('<circle cx="12" cy="8" r="5"/><path d="M12 13v7"/><path d="M9 17h6"/>');
const DIA_CONSCIENCIA: IconDef = g('<path d="M9 18a6 6 0 1 1 6 0"/><path d="M9 18h6M10 21h4"/>');
const DIWALI: IconDef = g('<path d="M9 12h6a3 3 0 0 1 3 3v2H6v-2a3 3 0 0 1 3-3z"/><path d="M12 12V6M12 9a1.5 1.5 0 0 1-3 0M12 9a1.5 1.5 0 0 0 3 0"/>');
const EARTH_DAY: IconDef = g('<circle cx="12" cy="15" r="6"/><path d="M3 15h18"/><path d="M12 9c2.4 0 3.6 2 3.6 4M12 9V6M12 6c-2-1-4-1-5 0 1 2 3 2 5 1"/>');
const EASTER: IconDef = g('<path d="M12 4c4 0 6 4 6 8a6 6 0 0 1-12 0c0-4 2-8 6-8z"/><path d="M6 10c2-1 4-1 6 .5M18 14c-2 1-4 1-6-.5"/>');
const EASTER_EGG: IconDef = g('<path d="M12 4c4 0 6 4 6 8a6 6 0 0 1-12 0c0-4 2-8 6-8z"/><circle cx="16" cy="16" r="3"/><path d="M18.2 18.2 21 21"/>');
const ECLIPSE_HUNTER: IconDef = g('<circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 0 0 16z"/>');
const ERROR_404_EXPLORER: IconDef = g('<path d="M4 8h3v8H4M4 8l3 8"/><path d="M11 8h3.5a3 3 0 1 1 0 8H11z"/><path d="M17 8h3v8h-3M17 8l3 8"/>');
const FIRST_DAY_OF_SEASON: IconDef = g('<path d="M12 21V10"/><path d="M12 10c-3 0-5 2-5 5 3-1 5 .5 5 3"/>');
const FRIDAY_13TH: IconDef = g('<path d="M6 8h2.5v8H6"/><path d="M12 8a3.5 3.5 0 1 1 3.5 3.5A3.5 3.5 0 0 1 12 16"/>');
const HALLOWEEN: IconDef = g('<path d="M9 13c0-3 1.3-5 3-5s3 2 3 5c0 2-1.3 3-3 3s-3-1-3-3z"/><path d="M6 12v4M18 12v4"/><path d="M12 8V6M10 6h4"/>');
const INDEPENDENCE_DAY: IconDef = g('<path d="M8 14l2-2 4-4M10 14l-2 3M12 12l2 3M14 10l3-2M12 12l-3-2M12 12l3 2"/><path d="M3 21h18"/>');
const LEAP_DAY: IconDef = g('<path d="M12 4c-3 0-5 2-5 5 0 3 2 5 5 5s5-2 5-5c0-3-2-5-5-5z"/><path d="M7 14c0 4 2 7 5 7s5-3 5-7"/><circle cx="9" cy="8" r="1"/><circle cx="15" cy="8" r="1"/>');
const LUCKY_777: IconDef = g('<circle cx="12" cy="12" r="8"/><path d="M9 9h6l-3 9"/>');
const LUNAR_ROAMER: IconDef = g('<path d="M19 14A8 8 0 1 1 10 5a6.5 6.5 0 0 0 9 9z"/><path d="M6 18c1 0 1-2 2-2s1 2 2 2"/>');
const MAY_THE_FOURTH: IconDef = g('<path d="M2 12h12"/><circle cx="16" cy="12" r="1.5"/><path d="M17.5 12H22"/>');
const MEXICO_INDEPENDENCE: IconDef = g('<path d="M12 5v7"/><path d="M12 12l-3-3M12 12l3-3"/><path d="M6 21V8a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v13"/>');
const MIDNIGHT_OIL: IconDef = g('<path d="M12 4v6"/><path d="M8 10h8l-2 6h-4z"/><path d="M11 16v2M13 16v2M9 20h6"/>');
const MILLENNIUM_ROAM: IconDef = g('<path d="M6 18V8l6 6V8"/><path d="M14 18V8l6 6V8"/>');
const NEW_YEAR: IconDef = g('<path d="M4 10l5-5 5 5-5 4z"/><path d="M3 9l6-3M5 13l3-2"/><path d="M17 13l3-8M15 16l4-3"/>');
const NEW_YEARS_EVE: IconDef = g('<circle cx="12" cy="13" r="8"/><path d="M12 9v4M12 13l3 2"/><path d="M16 3v3"/>');
const PALINDROME_DAY: IconDef = g('<path d="M4 4h7v16H4z"/><path d="M13 4h7v16h-7z"/><path d="M11 9l-2 3 2 3M13 9l2 3-2 3"/>');
const PI_DAY: IconDef = g('<path d="M7 5h9M7 5v14M7 5c4 0 9-1 9 6 0 7-5 6-9 6"/>');
const POLYGLOT: IconDef = g('<path d="M5 7h9"/><path d="M9.5 7v4"/><path d="M9 12c2-1.5 4-1.5 6 0"/><path d="M13 15l3-3 3 3"/>');
const RAMADAN: IconDef = g('<path d="M19 14A8 8 0 1 1 10 5a6.5 6.5 0 0 0 9 9z"/><path d="M18 4l.6 1.4L20 6l-1.4.6L18 8l-.6-1.4L16 6l1.4-.6z"/>');
const REMEMBRANCE_DAY: IconDef = g('<circle cx="12" cy="12" r="3.5"/><path d="M9 9c0-2 1.5-3.5 3-3.5s3 1.5 3 3.5M15 9c2 0 3.5 1.5 3.5 3.5s-1.5 3-3.5 3M15 15.5c0 2-1.5 3-3 3s-3-1-3-3M9 15.5c-2 0-3.5-1.5-3.5-3s1.5-3.5 3.5-3.5"/>');
const ROSH_HASHANAH: IconDef = g('<circle cx="12" cy="14" r="5.5"/><path d="M12 8.5V6M12 6c-2-1-3 1-1.5 2.5"/>');
const SNAKE_EYES: IconDef = g('<rect x="5" y="5" width="6" height="6" rx="1"/><rect x="13" y="13" width="6" height="6" rx="1"/><circle cx="8" cy="8" r="1"/><circle cx="16" cy="16" r="1"/>');
const SOLSTICE_SEEKER: IconDef = g('<circle cx="12" cy="12" r="4"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4M5 5l3 3M16 16l3 3M19 5l-3 3M8 16l-3 3"/>');
const ST_PATRICKS_DAY: IconDef = g('<circle cx="9" cy="9" r="3"/><circle cx="15" cy="9" r="3"/><circle cx="12" cy="14" r="3"/><path d="M12 17v3"/>');
const TALK_LIKE_PIRATE: IconDef = g('<path d="M4 11h16l-3 8H7z"/><path d="M4 11c2-3 14-3 16 0"/><path d="M10 7h4l1-3H9z"/>');
const THANKSGIVING: IconDef = g('<path d="M4 17c3-2 6-8 10-11 3 2 5 4 6 7-2 2-4 4-6 5-3 0-6-1-10-1z"/><path d="M4 17c5-1 8-2 11-4"/>');
const TRIPLE_SEVENS: IconDef = g('<path d="M6 6l3 3-3 3M6 12v4"/><path d="M12 6l3 3-3 3M12 12v4"/><path d="M18 6l3 3-3 3M18 12v4"/>');
const VALENTINES_DAY: IconDef = g('<path d="M12 20s-7-4.4-7-9.1A3.9 3.9 0 0 1 12 7.6a3.9 3.9 0 0 1 7 3.3C19 15.6 12 20 12 20z"/><path d="M19 3l-7 7M15 3h4v4"/>');
const YOUTH_DAY: IconDef = g('<circle cx="12" cy="10" r="3"/><path d="M6 18c0-3.3 2.7-6 6-6s6 2.7 6 6"/><path d="M9 5L7 2M15 5l2-3"/>');
// ── milestone ─────────────────────────────────────────────────────────────
/** Ascending bar chart — one bar per level tier, so every level badge is
 *  a distinct, recognisable "level" glyph (level-5 → 1 bar … level-150 → 13). */
const levelBars = (n: number): IconDef =>
  g(
    Array.from({ length: n }, (_, i) => {
      const x = (5.5 + (i * 13.5) / n).toFixed(2);
      const top = (15 - (i * 11) / n).toFixed(2);
      return `<path d="M${x} 20V${top}"/>`;
    }).join(""),
  );
const CENTURION_BADGES: IconDef = g('<circle cx="12" cy="13" r="6"/><path d="M12 20l-1.5 3h3zM9 8l.5-3h5l.5 3"/><path d="M4 7c1.5 2 2.5 4 2.5 6M20 7c-1.5 2-2.5 4-2.5 6"/>');
const DEMIGOD: IconDef = g('<path d="M5 8c1.5-3 4-4 7-1.5C14.5 4 17 5 19 8c-2 3-4 4-7 2.5C9 12 7 11 5 8z"/><path d="M12 10.5V19M8 19h8"/>');
const GRANDMASTER: IconDef = g('<path d="M3 8l4 3 5-6 5 6 4-3-2 12H5z"/><path d="M12 8l1.5 2.5L15 13l-3-1-3 1 1.5-2.5z"/>');
const MASTER_ROAMER: IconDef = g('<path d="M12 21s-7-5.2-7-10.3A4.7 4.7 0 0 1 12 5a4.7 4.7 0 0 1 7 5.7C19 15.8 12 21 12 21z"/><path d="M18 6l.5 1 1 .5-1 .5-.5 1-.5-1-1-.5 1-.5z"/>');
const XP_MILLIONAIRE: IconDef = g('<path d="M6 3h12l4 6-10 12L2 9z"/><path d="M8 10l4 4 4-4M10 10l2-2 2 2"/>');
// ── gift ──────────────────────────────────────────────────────────────────
const AMBASSADOR: IconDef = g('<circle cx="12" cy="12" r="7"/><path d="M9.5 12l2 2 3.5-4"/><path d="M9 6l1.5-2h3L15 6"/>');
const BETA_PIONEER: IconDef = g('<path d="M9 3h6M10 3v5l-4 11a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1l-4-11V3"/><path d="M7 15h10"/>');
const BUG_HUNTER: IconDef = g('<circle cx="12" cy="12" r="4"/><path d="M12 8V4M12 20v-4M8 8L5 5M16 8l3-3M8 16l-3 3M16 16l3 3M8 12H4M20 12h-4"/>');
const COMMUNITY_HERO: IconDef = g('<circle cx="8" cy="9" r="3"/><circle cx="16" cy="9" r="3"/><path d="M3 20c0-3 2-5 5-5M16 15c3 0 5 2 5 5"/><path d="M12 5l1.3 2.6 3 .4-2.2 2 .5 3-2.6-1.4-2.6 1.4.5-3-2.2-2 3-.4z"/>');
const CURATOR_SPOTLIGHT: IconDef = g('<path d="M12 5a3 3 0 0 1 3 3v0"/><path d="M9 9h6v3l-3 7-3-7z"/><path d="M10 21h4"/>');
const EARLY_ADOPTER: IconDef = g('<path d="M6 21V4"/><path d="M6 4c4 2 8-2 12 0"/><path d="M6 14h9l-2 2 2 2H6z"/>');
const GOOD_CITIZEN: IconDef = g('<path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z"/><path d="M8.5 11l2.3 2.3L15.5 9"/>');
const INNOVATOR: IconDef = g('<path d="M9 18a6 6 0 1 1 6 0"/><path d="M9 18h6M10 21h4M12 4V3M3 12H2M21 12h1"/>');
const MODERATOR: IconDef = g('<path d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6z"/><path d="M12 8l1.4 2.8 3 .4-2.2 2 .5 3-2.7-1.4-2.7 1.4.5-3-2.2-2 3-.4z"/>');
const RECORD_BREAKER: IconDef = g('<circle cx="12" cy="13" r="7"/><path d="M12 9v4l3 2"/><path d="M13 3l-3 5h2.5L12 12"/>');
const ROAM_LEGEND: IconDef = g('<path d="M5 8c-1 3 0 6 2.5 8M19 8c1 3 0 6-2.5 8"/><path d="M12 5l1.6 3.4 3.7.5-2.7 2.5.7 3.7L12 13.6 8.7 15.1l.7-3.7L6.7 8.9l3.7-.5z"/>');
const ROAM_ROYALTY: IconDef = g('<path d="M3 8l4 3 5-6 5 6 4-3-2 12H5z"/><circle cx="12" cy="14" r="1.2"/>');
const ROAM_SCHOLAR: IconDef = g('<path d="M12 5l9 4-9 4-9-4z"/><path d="M4 12v5c0 2 3.6 4 8 4s8-2 8-4v-5"/><path d="M21 9v5"/>');
const SEASONAL_HERO: IconDef = g('<circle cx="12" cy="12" r="8"/><path d="M12 4v16M4 12h16"/><path d="M16 16l2.5 2.5"/>');
const SPOTLIGHT: IconDef = g('<path d="M12 3l2 4 4 .5-3 3 1 4-4-2-4 2 1-4-3-3 4-.5z"/><path d="M12 14v3M9.5 19h5"/>');
const TOP_GUN: IconDef = g('<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="2"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4M5 5l3 3M16 16l3 3M19 5l-3 3M8 16l-3 3"/>');
const TRAILBLAZER: IconDef = g('<circle cx="5" cy="19" r="2.5"/><path d="M7.5 16.5L20 4"/><path d="M15 4h5v5"/>');

// ── Per-badge overrides (slug → base concept glyph) ──────────────────────
export const BADGE_GLYPHS: Record<string, IconDef> = {
  "time-traveler": CLOCK,
  comeback: REFRESH,
  // ── exploration ──
  "category-explorer-bronze": CATEGORY_EXPLORER,
  "category-explorer-gold": CATEGORY_EXPLORER,
  "category-explorer-silver": CATEGORY_EXPLORER,
  "century-club": CENTURY_CLUB,
  "curious-george": CURIOUS_GEORGE,
  "daily-double": DAILY_DOUBLE,
  "dawn-patrol": DAWN_PATROL,
  "day-tripper": DAY_TRIPPER,
  "deep-dive": DEEP_DIVE,
  "domain-hoarder": DOMAIN_HOARDER,
  "early-bird": EARLY_BIRD,
  "explorer-supreme": EXPLORER_SUPREME,
  "fifty-fifty": FIFTY_FIFTY,
  "first-roam": FIRST_ROAM,
  "fresh-finds": FRESH_FINDS,
  "globetrotter-bronze": GLOBETROTTER,
  "globetrotter-gold": GLOBETROTTER,
  "globetrotter-platinum": GLOBETROTTER,
  "globetrotter-silver": GLOBETROTTER,
  "home-turf": HOME_TURF,
  "insomniac": INSOMNIAC,
  "jet-setter": JET_SETTER,
  "lunch-break": LUNCH_BREAK,
  "monthly-explorer": MONTHLY_EXPLORER,
  "night-owl": NIGHT_OWL,
  "nocturnal": NOCTURNAL,
  "nomad-bronze": NOMAD,
  "nomad-gold": NOMAD,
  "nomad-platinum": NOMAD,
  "nomad-silver": NOMAD,
  "pinball-wizard": PINBALL_WIZARD,
  "repeat-visitor": REPEAT_VISITOR,
  "roam-marathon": ROAM_MARATHON,
  "session-beast": SESSION_BEAST,
  "speed-demon": SPEED_DEMON,
  "speed-reader": SPEED_READER,
  "subcategory-specialist": SUBCATEGORY_SPECIALIST,
  "sunset-seeker": SUNSET_SEEKER,
  "the-wanderer": THE_WANDERER,
  "wanderer-bronze": WANDERER,
  "wanderer-gold": WANDERER,
  "wanderer-silver": WANDERER,
  "world-traveler": WORLD_TRAVELER,
  // ── collecting ──
  "archivist-bronze": CO_ARCHIVIST,
  "archivist-gold": CO_ARCHIVIST,
  "archivist-silver": CO_ARCHIVIST,
  "bookworm": BOOKWORM,
  "category-filler-collector": CO_FILLER,
  "collector-bronze": COLLECTOR,
  "collector-gold": COLLECTOR,
  "collector-platinum": COLLECTOR,
  "collector-silver": COLLECTOR,
  "collectors-collector": COLLECTORS_COLLECTOR,
  "completionist": COMPLETIONIST,
  "consistent-collector": CONSISTENT_COLLECTOR,
  "domain-collector": DOMAIN_COLLECTOR,
  "early-bird-collector": EARLY_BIRD_COLLECTOR,
  "emergency-fund": EMERGENCY_FUND,
  "first-save": FIRST_SAVE,
  "hoarder": HOARDER,
  "hoarder-strikes-back": HOARDER_STRIKES_BACK,
  "language-collector": LANGUAGE_COLLECTOR,
  "long-term-storage": LONG_TERM_STORAGE,
  "mega-collector": MEGA_COLLECTOR,
  "minimalist": MINIMALIST,
  "one-stop-shop": ONE_STOP_SHOP,
  "pack-mule": PACK_MULE,
  "pocket-filler": POCKET_FILLER,
  "quick-save": QUICK_SAVE,
  "save-streak": SAVE_STREAK,
  "save-wave": SAVE_WAVE,
  "speed-collector": SPEED_COLLECTOR,
  "tag-master": TAG_MASTER,
  "tagger-bronze": TAGGER,
  "tagger-gold": TAGGER,
  "tagger-silver": TAGGER,
  "un-saver": UN_SAVER,
  "weekend-hoarder": WEEKEND_HOARDER,
  "weekly-collector": WEEKLY_COLLECTOR,
  "year-old": YEAR_OLD,
  // ── curating ──
  "award-winner": AWARD_WINNER,
  "collection-remix": COLLECTION_REMIX,
  "collection-streak": COLLECTION_STREAK,
  "curator-bronze": CURATOR,
  "curator-gold": CURATOR,
  "curator-silver": CURATOR,
  "curator-supreme": CURATOR_SUPREME,
  "curators-block": CURATORS_BLOCK,
  "curators-eye": CURATORS_EYE,
  "curators-pick": CURATORS_PICK,
  "daily-curation": DAILY_CURATION,
  "descriptivist": DESCRIPTIVIST,
  "diverse-collections": DIVERSE_COLLECTIONS,
  "favorited-bronze": FAVORITED,
  "favorited-gold": FAVORITED,
  "favorited-silver": FAVORITED,
  "first-collection": FIRST_COLLECTION,
  "hidden-gem": HIDDEN_GEM,
  "linker": LINKER,
  "mega-collection": MEGA_COLLECTION,
  "mega-share": MEGA_SHARE,
  "micro-curator": MICRO_CURATOR,
  "niched-down": NICHED_DOWN,
  "pack-rat-bronze": PACK_RAT,
  "pack-rat-gold": PACK_RAT,
  "pack-rat-silver": PACK_RAT,
  "public-curator": PUBLIC_CURATOR,
  "recycler": RECYCLER,
  "refined-taste": REFINED_TASTE,
  "solo-artist": SOLO_ARTIST,
  "thematic": THEMATIC,
  "theme-master": THEME_MASTER,
  "weekly-publisher": WEEKLY_PUBLISHER,
  // ── social ──
  "beloved": BELOVED,
  "bio-hacker": BIO_HACKER,
  "birthday-buddy": BIRTHDAY_BUDDY,
  "broadcaster": BROADCASTER,
  "celebrity": CELEBRITY,
  "chatterbox": CHATTERBOX,
  "connector": CONNECTOR,
  "fan-club": FAN_CLUB,
  "first-follower": FIRST_FOLLOWER,
  "first-share": FIRST_SHARE,
  "follow-back": FOLLOW_BACK,
  "follow-frenzy": FOLLOW_FRENZY,
  "follower-50": FOLLOWER_50,
  "friendly-face": FRIENDLY_FACE,
  "full-profile": FULL_PROFILE,
  "influencer-bronze": INFLUENCER,
  "influencer-gold": INFLUENCER,
  "influencer-platinum": INFLUENCER,
  "influencer-silver": INFLUENCER,
  "inner-circle": INNER_CIRCLE,
  "link-in-bio": LINK_IN_BIO,
  "mutual-admiration": MUTUAL_ADMIRATION,
  "name-dropper": NAME_DROPPER,
  "profile-perfectionist": PROFILE_PERFECTIONIST,
  "profile-pic": PROFILE_PIC,
  "public-figure": PUBLIC_FIGURE,
  "share-happy-hour": SHARE_HAPPY_HOUR,
  "social-butterfly-bronze": SOCIAL_BUTTERFLY,
  "social-butterfly-gold": SOCIAL_BUTTERFLY,
  "social-butterfly-silver": SOCIAL_BUTTERFLY,
  "social-network": SOCIAL_NETWORK,
  "the-lurker": THE_LURKER,
  "two-way-street": TWO_WAY_STREET,
  "verified-roamer": VERIFIED_ROAMER,
  "viral-bronze": VIRAL,
  "viral-gold": VIRAL,
  "viral-silver": VIRAL,
  // ── streaks ──
  "consistency-king": CONSISTENCY_KING,
  "double-digits": DOUBLE_DIGITS,
  "early-riser-streak": EARLY_RISER_STREAK,
  "full-year": FULL_YEAR,
  "half-year-hero": HALF_YEAR_HERO,
  "hot-streak-bronze": HOT_STREAK,
  "hot-streak-gold": HOT_STREAK,
  "hot-streak-silver": HOT_STREAK,
  "night-owl-streak": NIGHT_OWL_STREAK,
  "phoenix": PHOENIX,
  "seasoned": SEASONED,
  "the-marathon": THE_MARATHON,
  "twenty-one": TWENTY_ONE,
  "unstoppable": UNSTOPPABLE,
  "weekend-streak": WEEKEND_STREAK,
  // ── contributing ──
  "100-club": CLUB_100,
  "approval-streak": APPROVAL_STREAK,
  "approved-bronze": APPROVED,
  "approved-gold": APPROVED,
  "approved-silver": APPROVED,
  "archivist": THE_ARCHIVIST,
  "category-filler": CATEGORY_FILLER,
  "citizen-journalist": CITIZEN_JOURNALIST,
  "community-builder": COMMUNITY_BUILDER,
  "contributor-bronze": CONTRIBUTOR,
  "contributor-gold": CONTRIBUTOR,
  "contributor-platinum": CONTRIBUTOR_PLATINUM,
  "contributor-silver": CONTRIBUTOR,
  "fast-track": FAST_TRACK,
  "first-submission": FIRST_SUBMISSION,
  "global-contributor": GLOBAL_CONTRIBUTOR,
  "night-owl-submitter": NIGHT_OWL_SUBMITTER,
  "pioneer": PIONEER,
  "prolific": PROLIFIC,
  "quality-control": QUALITY_CONTROL,
  "quality-first": QUALITY_FIRST,
  "speed-submitter": SPEED_SUBMITTER,
  "subcategory-scout": SUBCATEGORY_SCOUT,
  "submission-streak": SUBMISSION_STREAK,
  "top-contributor": TOP_CONTRIBUTOR,
  "variety-submitter": VARIETY_SUBMITTER,
  "weekday-warrior": WEEKDAY_WARRIOR,
  "weekend-submitter": WEEKEND_SUBMITTER,
  // ── curiosity ──
  "roll-rate-5": ROLL_RATE_5,
  "roll-wallpaper": ROLL_WALLPAPER,
  "weekly-challenge-warrior": WEEKLY_CHALLENGE_WARRIOR,
  // ── engagement ──
  "challenge-accepted": CHALLENGE_ACCEPTED,
  "challenge-addict": CHALLENGE_ADDICT,
  "challenge-hoarder": CHALLENGE_HOARDER,
  "challenge-master": CHALLENGE_MASTER,
  "critic": CRITIC,
  "daily-devotion": DAILY_DEVOTION,
  "daily-driver": DAILY_DRIVER,
  "daily-dynamo": DAILY_DYNAMO,
  "daily-routine": DAILY_ROUTINE,
  "deep-reader": DEEP_READER,
  "diversity-champ": DIVERSITY_CHAMP,
  "downer": DOWNER,
  "feedback-loop": FEEDBACK_LOOP,
  "first-challenge": FIRST_CHALLENGE,
  "january-grind": JANUARY_GRIND,
  "last-minute-save": LAST_MINUTE_SAVE,
  "loyalist": LOYALIST,
  "marathon": MARATHON,
  "monthly-mastery": MONTHLY_MASTERY,
  "monthly-mogul": MONTHLY_MOGUL,
  "morning-rater": MORNING_RATER,
  "non-committal": NON_COMMITTAL,
  "omnivore": OMNIVORE,
  "overachiever": OVERACHIEVER,
  "perfect-month": PERFECT_MONTH,
  "perfect-week": PERFECT_WEEK,
  "power-user": POWER_USER,
  "rate-by-category": RATE_BY_CATEGORY,
  "rate-everything": RATE_EVERYTHING,
  "rate-spree": RATE_SPREE,
  "rate-streak": RATE_STREAK,
  "rater-bronze": RATER,
  "rater-gold": RATER,
  "rater-silver": RATER,
  "session-beast-engagement": SESSION_BEAST_ENGAGEMENT,
  "session-surfer": SESSION_SURFER,
  "speed-challenger": SPEED_CHALLENGER,
  "streak-challenger": STREAK_CHALLENGER,
  "the-completionist-rate": THE_COMPLETIONIST_RATE,
  "the-equalizer": THE_EQUALIZER,
  "the-judge": THE_JUDGE,
  "triple-threat": TRIPLE_THREAT,
  "voting-power": VOTING_POWER,
  "weekend-warrior": WEEKEND_WARRIOR,
  "weekly-champion": WEEKLY_CHAMPION,
  "weekly-legend": WEEKLY_LEGEND,
  "weekly-warrior": WEEKLY_WARRIOR,
  "well-rounded": WELL_ROUNDED,
  // ── games ──
  "compiler-lvl-25": COMPILER_LVL_25,
  "gamer-3": GAMER_3,
  "gamer-all": GAMER_ALL,
  "gamer-first": GAMER_FIRST,
  "high-score-1000": HIGH_SCORE_1000,
  "high-score-500": HIGH_SCORE_500,
  "relay-lvl-25": RELAY_LVL_25,
  "win-botfield": WIN_BOTFIELD,
  "win-compiler": WIN_COMPILER,
  "win-debris": WIN_DEBRIS,
  "win-firewalk": WIN_FIREWALK,
  "win-relay": WIN_RELAY,
  "win-substrate": WIN_SUBSTRATE,
  "win-underweb": WIN_UNDERWEB,
  // ── secret ──
  "century-roam": CENTURY_ROAM,
  "china-national-day": CHINA_NATIONAL_DAY,
  "christmas-day": CHRISTMAS_DAY,
  "cinco-de-mayo": CINCO_DE_MAYO,
  "dia-consciencia": DIA_CONSCIENCIA,
  "diwali": DIWALI,
  "earth-day": EARTH_DAY,
  "easter": EASTER,
  "easter-egg": EASTER_EGG,
  "eclipse-hunter": ECLIPSE_HUNTER,
  "error-404-explorer": ERROR_404_EXPLORER,
  "first-day-of-season": FIRST_DAY_OF_SEASON,
  "friday-13th": FRIDAY_13TH,
  "halloween": HALLOWEEN,
  "independence-day": INDEPENDENCE_DAY,
  "leap-day": LEAP_DAY,
  "lucky-777": LUCKY_777,
  "lunar-roamer": LUNAR_ROAMER,
  "may-the-fourth": MAY_THE_FOURTH,
  "mexico-independence": MEXICO_INDEPENDENCE,
  "midnight-oil": MIDNIGHT_OIL,
  "millennium-roam": MILLENNIUM_ROAM,
  "new-year": NEW_YEAR,
  "new-years-eve": NEW_YEARS_EVE,
  "palindrome-day": PALINDROME_DAY,
  "pi-day": PI_DAY,
  "polyglot": POLYGLOT,
  "ramadan": RAMADAN,
  "remembrance-day": REMEMBRANCE_DAY,
  "rosh-hashanah": ROSH_HASHANAH,
  "snake-eyes": SNAKE_EYES,
  "solstice-seeker": SOLSTICE_SEEKER,
  "st-patricks-day": ST_PATRICKS_DAY,
  "talk-like-pirate": TALK_LIKE_PIRATE,
  "thanksgiving": THANKSGIVING,
  "triple-sevens": TRIPLE_SEVENS,
  "valentines-day": VALENTINES_DAY,
  "youth-day": YOUTH_DAY,
  // ── milestone ──
  "centurion-badges": CENTURION_BADGES,
  "demigod": DEMIGOD,
  "grandmaster": GRANDMASTER,
  "level-5": levelBars(1),
  "level-10": levelBars(2),
  "level-15": levelBars(3),
  "level-20": levelBars(4),
  "level-25": levelBars(5),
  "level-30": levelBars(6),
  "level-40": levelBars(7),
  "level-50": levelBars(8),
  "level-60": levelBars(9),
  "level-75": levelBars(10),
  "level-100": levelBars(11),
  "level-125": levelBars(12),
  "level-150": levelBars(13),
  "master-roamer": MASTER_ROAMER,
  "xp-millionaire": XP_MILLIONAIRE,
  // ── gift ──
  "ambassador": AMBASSADOR,
  "beta-pioneer": BETA_PIONEER,
  "bug-hunter": BUG_HUNTER,
  "community-hero": COMMUNITY_HERO,
  "curator-spotlight": CURATOR_SPOTLIGHT,
  "early-adopter": EARLY_ADOPTER,
  "good-citizen": GOOD_CITIZEN,
  "innovator": INNOVATOR,
  "moderator": MODERATOR,
  "record-breaker": RECORD_BREAKER,
  "roam-legend": ROAM_LEGEND,
  "roam-royalty": ROAM_ROYALTY,
  "roam-scholar": ROAM_SCHOLAR,
  "seasonal-hero": SEASONAL_HERO,
  "spotlight": SPOTLIGHT,
  "top-gun": TOP_GUN,
  "trailblazer": TRAILBLAZER,
};

/** Legacy `engagement` category was renamed to `curiosity`
 *  (20261103000002_unify_xp_badges.sql). Keep a soft mapping so any stale
 *  row still resolves to the right glyph. */
export function normalizeCategory(category: string): string {
  return category === "engagement" ? "curiosity" : category;
}

/** N small filled pips under the glyph — a subtle per-tier variation for
 *  chained badges that share one base shape (bronze → 1 … legendary → 5). */
export function tierAccent(tier: number): string {
  const n = Math.max(0, Math.min(5, Math.floor(tier)));
  if (n === 0) return "";
  const x0 = 12 - ((n - 1) * 2.5) / 2;
  const dots: string[] = [];
  for (let i = 0; i < n; i++) {
    dots.push(
      `<circle cx="${(x0 + i * 2.5).toFixed(2)}" cy="21.2" r="0.85" fill="currentColor" stroke="none"/>`,
    );
  }
  return dots.join("");
}

export function resolveBadgeGlyph(slug: string, category: string, tier = 0): IconDef {
  const base = BADGE_GLYPHS[slug];
  if (base) {
    const accent = tierAccent(tier);
    return accent ? g(base.children + accent) : base;
  }
  return (
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
