/**
 * seed-salk-aging.mjs — Salk Institute Aging seeder
 * Category: CATEGORY.MIND_BODY → SUBCATEGORY.AGING_LONGEVITY
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.salk.edu",
  cacheFileName: "salk-aging.json",
  displayName: "🔬 Salk Institute Aging",
  feedUrl: "https://www.salk.edu/news-release/feed/",
  articlePathRegex: /(news-release|research)/,
  siteSuffixRegex: \s*[-–—]\s*salk.edu\s*$,
  category_id: CATEGORY.MIND_BODY,
  subcategory_id: SUBCATEGORY.AGING_LONGEVITY,
  source: "salk-aging",
  seeder_score: 0.8,
  maxArticles: 500,
  maxPages: 20,
});
