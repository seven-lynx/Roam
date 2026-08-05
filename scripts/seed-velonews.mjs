/**
 * seed-velonews.mjs — VeloNews seeder
 * Category: CATEGORY.MIND_BODY → SUBCATEGORY.HUMAN_PERFORMANCE
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.velonews.com",
  cacheFileName: "velonews.json",
  displayName: "🚴 VeloNews",
  feedUrl: "https://www.velonews.com/feed/",
  articlePathRegex: /(training|gear|news)/,
  siteSuffixRegex: \s*[-–—]\s*velonews.com\s*$,
  category_id: CATEGORY.MIND_BODY,
  subcategory_id: SUBCATEGORY.HUMAN_PERFORMANCE,
  source: "velonews",
  seeder_score: 0.65,
  maxArticles: 500,
  maxPages: 20,
});
