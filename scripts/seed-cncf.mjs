/**
 * seed-cncf.mjs — CNCF seeder
 * Category: CATEGORY.TECHNOLOGY → SUBCATEGORY.DEVOPS_INFRASTRUCTURE
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.cncf.io",
  cacheFileName: "cncf.json",
  displayName: "☸ CNCF",
  feedUrl: "https://www.cncf.io/blog/feed/",
  articlePathRegex: /(blog|newsroom|reports)/,
  siteSuffixRegex: \s*[-–—]\s*cncf.io\s*$,
  category_id: CATEGORY.TECHNOLOGY,
  subcategory_id: SUBCATEGORY.DEVOPS_INFRASTRUCTURE,
  source: "cncf",
  seeder_score: 0.8,
  maxArticles: 500,
  maxPages: 20,
});
