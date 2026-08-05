/**
 * seed-barbellmedicine.mjs — Barbell Medicine seeder
 * Category: CATEGORY.MIND_BODY → SUBCATEGORY.HUMAN_PERFORMANCE
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.barbellmedicine.com",
  cacheFileName: "barbellmedicine.json",
  displayName: "💪 Barbell Medicine",
  feedUrl: "https://www.barbellmedicine.com/blog/feed/",
  articlePathRegex: /blog/,
  siteSuffixRegex: \s*[-–—]\s*barbellmedicine.com\s*$,
  category_id: CATEGORY.MIND_BODY,
  subcategory_id: SUBCATEGORY.HUMAN_PERFORMANCE,
  source: "barbellmedicine",
  seeder_score: 0.75,
  maxArticles: 500,
  maxPages: 20,
});
