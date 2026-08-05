/**
 * seed-howandwhys.mjs — How and Whys seeder
 * Category: CATEGORY.WEIRD_WONDERFUL → SUBCATEGORY.FORTEANA_ANOMALIES
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.howandwhys.com",
  cacheFileName: "howandwhys.json",
  displayName: "❓ How and Whys",
  feedUrl: "https://www.howandwhys.com/feed/",
  articlePathRegex: /(mysteries|history|science)/,
  siteSuffixRegex: \s*[-–—]\s*howandwhys.com\s*$,
  category_id: CATEGORY.WEIRD_WONDERFUL,
  subcategory_id: SUBCATEGORY.FORTEANA_ANOMALIES,
  source: "howandwhys",
  seeder_score: 0.5,
  maxArticles: 500,
  maxPages: 20,
});
