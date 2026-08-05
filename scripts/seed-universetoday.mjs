/**
 * seed-universetoday.mjs — Universe Today seeder
 * Astronomy news, space exploration, astrophysics explainers.
 * Category: SCIENCE → SPACE_ASTRONOMY
 * Multi-method: RSS → Sitemap → Wayback CDX
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.universetoday.com",
  cacheFileName: "universetoday.json",
  displayName: "🔭 Universe Today",
  feedUrl: "https://www.universetoday.com/feed/",
  articlePathRegex: /\/(\d{6,})\/[a-z0-9-]+\/?$/i,
  siteSuffixRegex: /[–\-|]\s*Universe Today\s*$/i,
  category_id: CATEGORY.SCIENCE,
  subcategory_id: SUBCATEGORY.SPACE_ASTRONOMY,
  source: "universetoday",
  seeder_score: 0.8,
});