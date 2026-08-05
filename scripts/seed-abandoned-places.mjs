/**
 * seed-abandoned-places.mjs — Abandoned Places seeder
 * Category: CATEGORY.WEIRD_WONDERFUL → SUBCATEGORY.UNDERGROUND_SUBTERRANEAN
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.abandoned-places.com",
  cacheFileName: "abandoned-places.json",
  displayName: "🏚 Abandoned Places",
  feedUrl: "https://www.abandoned-places.com/feed/",
  articlePathRegex: /(blog|locations|gallery)/,
  siteSuffixRegex: \s*[-–—]\s*abandoned-places.com\s*$,
  category_id: CATEGORY.WEIRD_WONDERFUL,
  subcategory_id: SUBCATEGORY.UNDERGROUND_SUBTERRANEAN,
  source: "abandoned-places",
  seeder_score: 0.55,
  maxArticles: 500,
  maxPages: 20,
});
