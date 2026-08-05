/**
 * seed-npj-aging.mjs — npj Aging seeder
 * Category: CATEGORY.MIND_BODY → SUBCATEGORY.AGING_LONGEVITY
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.nature.com",
  cacheFileName: "npj-aging.json",
  displayName: "📖 npj Aging",
  feedUrl: "https://www.nature.com/npjaging.rss",
  articlePathRegex: /articles/,
  siteSuffixRegex: \s*[-–—]\s*nature.com\s*$,
  category_id: CATEGORY.MIND_BODY,
  subcategory_id: SUBCATEGORY.AGING_LONGEVITY,
  source: "npj-aging",
  seeder_score: 0.8,
  maxArticles: 500,
  maxPages: 20,
});
