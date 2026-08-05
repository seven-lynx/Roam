/**
 * seed-bldgblog.mjs — BLDGBLOG seeder
 * Architectural speculation, urban exploration, buried infrastructure, weird geography.
 * Category: WEIRD_WONDERFUL → UNUSUAL_PLACES
 * Multi-method: RSS → Sitemap → Wayback CDX
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "bldgblog.com",
  cacheFileName: "bldgblog.json",
  displayName: "🏗️ BLDGBLOG",
  feedUrl: "https://bldgblog.com/feed/",
  articlePathRegex: /\/20\d{2}\/\d{2}\/[a-z0-9-]+\/?$/i,
  siteSuffixRegex: /[–\-|]\s*BLDGBLOG\s*$/i,
  category_id: CATEGORY.WEIRD_WONDERFUL,
  subcategory_id: SUBCATEGORY.UNUSUAL_PLACES,
  source: "bldgblog",
  seeder_score: 0.8,
});