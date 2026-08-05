/**
 * seed-derelictlondon.mjs — Derelict London seeder
 * Category: CATEGORY.WEIRD_WONDERFUL → SUBCATEGORY.UNDERGROUND_SUBTERRANEAN
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.derelictlondon.com",
  cacheFileName: "derelictlondon.json",
  displayName: "🏚 Derelict London",
  feedUrl: "https://www.derelictlondon.com/feed/",
  articlePathRegex: /([a-z-]+)/,
  siteSuffixRegex: \s*[-–—]\s*derelictlondon.com\s*$,
  category_id: CATEGORY.WEIRD_WONDERFUL,
  subcategory_id: SUBCATEGORY.UNDERGROUND_SUBTERRANEAN,
  source: "derelictlondon",
  seeder_score: 0.6,
  maxArticles: 500,
  maxPages: 20,
});
