/**
 * seed-lindahall.mjs — Linda Hall Library seeder
 * Category: CATEGORY.HISTORY_IDEAS → SUBCATEGORY.HISTORY_SCIENCE_TECHNOLOGY
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.lindahall.org",
  cacheFileName: "lindahall.json",
  displayName: "📖 Linda Hall Library",
  feedUrl: "https://www.lindahall.org/feed/",
  articlePathRegex: /(experience|research|about)/,
  siteSuffixRegex: \s*[-–—]\s*lindahall.org\s*$,
  category_id: CATEGORY.HISTORY_IDEAS,
  subcategory_id: SUBCATEGORY.HISTORY_SCIENCE_TECHNOLOGY,
  source: "lindahall",
  seeder_score: 0.7,
  maxArticles: 500,
  maxPages: 20,
});
