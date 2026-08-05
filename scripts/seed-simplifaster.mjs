/**
 * seed-simplifaster.mjs — SimpliFaster seeder
 * Category: CATEGORY.MIND_BODY → SUBCATEGORY.HUMAN_PERFORMANCE
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "simplifaster.com",
  cacheFileName: "simplifaster.json",
  displayName: "🏃 SimpliFaster",
  feedUrl: "https://simplifaster.com/feed/",
  articlePathRegex: /(articles|blog|categories)/,
  siteSuffixRegex: \s*[-–—]\s*simplifaster.com\s*$,
  category_id: CATEGORY.MIND_BODY,
  subcategory_id: SUBCATEGORY.HUMAN_PERFORMANCE,
  source: "simplifaster",
  seeder_score: 0.7,
  maxArticles: 500,
  maxPages: 20,
});
