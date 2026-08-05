/**
 * seed-whoi.mjs — WHOI seeder
 * Category: CATEGORY.PEOPLE_PLACES → SUBCATEGORY.OCEANS_MARITIME
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.whoi.edu",
  cacheFileName: "whoi.json",
  displayName: "🌊 WHOI",
  feedUrl: "https://www.whoi.edu/who-we-are/media-relations/news-releases/feed/",
  articlePathRegex: /(news-release|oceanus|what-we-do)/,
  siteSuffixRegex: \s*[-–—]\s*whoi.edu\s*$,
  category_id: CATEGORY.PEOPLE_PLACES,
  subcategory_id: SUBCATEGORY.OCEANS_MARITIME,
  source: "whoi",
  seeder_score: 0.8,
  maxArticles: 500,
  maxPages: 20,
});
