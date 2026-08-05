/**
 * seed-fastly.mjs — Fastly seeder
 * Category: CATEGORY.TECHNOLOGY → SUBCATEGORY.DEVOPS_INFRASTRUCTURE
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.fastly.com",
  cacheFileName: "fastly.json",
  displayName: "⚡ Fastly",
  feedUrl: "https://www.fastly.com/blog/feed",
  articlePathRegex: /blog/,
  siteSuffixRegex: \s*[-–—]\s*fastly.com\s*$,
  category_id: CATEGORY.TECHNOLOGY,
  subcategory_id: SUBCATEGORY.DEVOPS_INFRASTRUCTURE,
  source: "fastly",
  seeder_score: 0.65,
  maxArticles: 500,
  maxPages: 20,
});
