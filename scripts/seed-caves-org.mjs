/**
 * seed-caves-org.mjs — NSS Caves seeder
 * Category: CATEGORY.WEIRD_WONDERFUL → SUBCATEGORY.UNDERGROUND_SUBTERRANEAN
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "caves.org",
  cacheFileName: "caves-org.json",
  displayName: "🕳 NSS Caves",
  feedUrl: "https://caves.org/feed/",
  articlePathRegex: /(news|conservation|education)/,
  siteSuffixRegex: \s*[-–—]\s*caves.org\s*$,
  category_id: CATEGORY.WEIRD_WONDERFUL,
  subcategory_id: SUBCATEGORY.UNDERGROUND_SUBTERRANEAN,
  source: "caves-org",
  seeder_score: 0.7,
  maxArticles: 500,
  maxPages: 20,
});
