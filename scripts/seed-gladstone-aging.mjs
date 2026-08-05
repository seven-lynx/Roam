/**
 * seed-gladstone-aging.mjs — Gladstone Aging seeder
 * Category: CATEGORY.MIND_BODY → SUBCATEGORY.AGING_LONGEVITY
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "gladstone.org",
  cacheFileName: "gladstone-aging.json",
  displayName: "🔬 Gladstone Aging",
  feedUrl: "https://gladstone.org/news/feed",
  articlePathRegex: /(news|research|people)/,
  siteSuffixRegex: \s*[-–—]\s*gladstone.org\s*$,
  category_id: CATEGORY.MIND_BODY,
  subcategory_id: SUBCATEGORY.AGING_LONGEVITY,
  source: "gladstone",
  seeder_score: 0.8,
  maxArticles: 500,
  maxPages: 20,
});
