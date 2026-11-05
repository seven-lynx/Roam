import {
  CATEGORY_GLYPHS,
  BADGE_GLYPHS,
  DEFAULT_GLYPH,
  HIDDEN_GLYPH,
  resolveBadgeGlyph,
  normalizeCategory,
  tierAccent,
  TIER_RING,
} from "../lib/icons";
import { BADGE_CATALOG } from "../lib/badge-catalog";

const CORE_CATEGORIES = [
  "exploration",
  "collecting",
  "curating",
  "social",
  "streaks",
  "contributing",
  "curiosity",
  "games",
  "secret",
  "milestone",
  "gift",
];

describe("icon glyph pack", () => {
  it("defines a glyph for every core category", () => {
    for (const c of CORE_CATEGORIES) {
      expect(CATEGORY_GLYPHS[c]?.children).toBeTruthy();
    }
  });

  it("every glyph is stroke SVG markup, not emoji", () => {
    const all = [
      DEFAULT_GLYPH,
      HIDDEN_GLYPH,
      ...Object.values(CATEGORY_GLYPHS),
      ...Object.values(BADGE_GLYPHS),
    ];
    for (const d of all) {
      expect(d.children).toMatch(/^(<circle|<rect|<path)/);
      expect(d.children).not.toMatch(/\p{Emoji_Presentation}/u);
    }
  });

  it("resolves an unknown slug to its category glyph", () => {
    expect(resolveBadgeGlyph("some-unknown", "games")).toBe(CATEGORY_GLYPHS.games);
  });

  it("maps the legacy engagement category to curiosity", () => {
    expect(normalizeCategory("engagement")).toBe("curiosity");
    expect(resolveBadgeGlyph("x", "engagement")).toBe(CATEGORY_GLYPHS.curiosity);
  });

  it("falls back to the default glyph for an unknown category", () => {
    expect(resolveBadgeGlyph("x", "nope")).toBe(DEFAULT_GLYPH);
  });

  it("prefers a per-badge override over the category fallback", () => {
    expect(resolveBadgeGlyph("time-traveler", "secret")).toBe(BADGE_GLYPHS["time-traveler"]);
  });

  it("defines a tier ring for tiers 1..5 and none for tier 0", () => {
    for (let t = 1; t <= 5; t++) expect(TIER_RING[t]).toBeTruthy();
    expect(TIER_RING[0]).toBeNull();
  });

  it("assigns a per-badge glyph to every catalog badge", () => {
    const missing = BADGE_CATALOG.filter((b) => !BADGE_GLYPHS[b.slug]);
    expect(missing.map((b) => b.slug)).toEqual([]);
  });

  it("renders a distinct glyph for every catalog badge", () => {
    const seen = new Map<string, string>();
    const dupes: string[] = [];
    for (const b of BADGE_CATALOG) {
      const children = resolveBadgeGlyph(b.slug, b.category, b.tier).children;
      const first = seen.get(children);
      if (first) dupes.push(`${b.slug} == ${first}`);
      else seen.set(children, b.slug);
    }
    expect(dupes).toEqual([]);
  });

  it("keeps tier chains on a shared base distinguished only by the accent", () => {
    const base = resolveBadgeGlyph("wanderer-bronze", "exploration", 1).children;
    expect(base).toContain('cy="21.2"');
    const higher = resolveBadgeGlyph("wanderer-gold", "exploration", 3).children;
    expect(higher.length).toBeGreaterThan(base.length);
  });

  it("adds one pip per tier (clamped at 5)", () => {
    expect(tierAccent(0)).toBe("");
    expect(tierAccent(1).match(/<circle/g)?.length).toBe(1);
    expect(tierAccent(3).match(/<circle/g)?.length).toBe(3);
    expect(tierAccent(5).match(/<circle/g)?.length).toBe(5);
    expect(tierAccent(9).match(/<circle/g)?.length).toBe(5);
  });
});

