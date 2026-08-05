/**
 * seed-subterranea.mjs — Subterranea Britannica seeder
 * Category: CATEGORY.WEIRD_WONDERFUL → SUBCATEGORY.UNDERGROUND_SUBTERRANEAN
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.subbrit.org.uk",
  cacheFileName: "subterranea.json",
  displayName: "🕳 Subterranea Britannica",
  feedUrl: "https://www.subbrit.org.uk/feed/",
  articlePathRegex: /(sites|features|news)/,
  siteSuffixRegex: \s*[-–—]\s*subbrit.org.uk\s*$,
  category_id: CATEGORY.WEIRD_WONDERFUL,
  subcategory_id: SUBCATEGORY.UNDERGROUND_SUBTERRANEAN,
  source: "subterranea",
  seeder_score: 0.6,
  maxArticles: 500,
  maxPages: 20,
});
