/**
 * seed-masshist.mjs — Mass Historical Society seeder
 * Category: CATEGORY.HISTORY_IDEAS → SUBCATEGORY.HISTORY_SCIENCE_TECHNOLOGY
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.masshist.org",
  cacheFileName: "masshist.json",
  displayName: "📜 Mass Historical Society",
  feedUrl: "https://www.masshist.org/feed",
  articlePathRegex: /(blog|collections|calendar)/,
  siteSuffixRegex: \s*[-–—]\s*masshist.org\s*$,
  category_id: CATEGORY.HISTORY_IDEAS,
  subcategory_id: SUBCATEGORY.HISTORY_SCIENCE_TECHNOLOGY,
  source: "masshist",
  seeder_score: 0.65,
  maxArticles: 500,
  maxPages: 20,
});
