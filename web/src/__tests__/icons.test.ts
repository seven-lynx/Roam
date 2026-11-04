import {
  CATEGORY_GLYPHS,
  BADGE_GLYPHS,
  DEFAULT_GLYPH,
  HIDDEN_GLYPH,
  resolveBadgeGlyph,
  normalizeCategory,
  TIER_RING,
} from "../lib/icons";

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
});
