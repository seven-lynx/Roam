/**
 * seed-healthyaging.mjs — Healthy Aging seeder
 * Category: CATEGORY.MIND_BODY → SUBCATEGORY.AGING_LONGEVITY
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.healthyaging.net",
  cacheFileName: "healthyaging.json",
  displayName: "🧑‍⚕ Healthy Aging",
  feedUrl: "https://www.healthyaging.net/feed/",
  articlePathRegex: /(articles|news|resources)/,
  siteSuffixRegex: \s*[-–—]\s*healthyaging.net\s*$,
  category_id: CATEGORY.MIND_BODY,
  subcategory_id: SUBCATEGORY.AGING_LONGEVITY,
  source: "healthyaging",
  seeder_score: 0.55,
  maxArticles: 500,
  maxPages: 20,
});
