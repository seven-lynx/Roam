/**
 * seed-runnersworld.mjs — Runner's World seeder
 * Category: CATEGORY.MIND_BODY → SUBCATEGORY.HUMAN_PERFORMANCE
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.runnersworld.com",
  cacheFileName: "runnersworld.json",
  displayName: "🏃 Runner's World",
  feedUrl: "https://www.runnersworld.com/feed/",
  articlePathRegex: /(training|health-injuries|nutrition-weight-loss)/,
  siteSuffixRegex: \s*[-–—]\s*runnersworld.com\s*$,
  category_id: CATEGORY.MIND_BODY,
  subcategory_id: SUBCATEGORY.HUMAN_PERFORMANCE,
  source: "runnersworld",
  seeder_score: 0.7,
  maxArticles: 500,
  maxPages: 20,
});
