/**
 * seed-uber-eng.mjs — Uber Engineering seeder
 * Category: CATEGORY.TECHNOLOGY → SUBCATEGORY.DEVOPS_INFRASTRUCTURE
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "eng.uber.com",
  cacheFileName: "uber-eng.json",
  displayName: "🚗 Uber Engineering",
  feedUrl: "https://eng.uber.com/feed/",
  articlePathRegex: /([a-z0-9-]+-){2,}/,
  siteSuffixRegex: \s*[-–—]\s*eng.uber.com\s*$,
  category_id: CATEGORY.TECHNOLOGY,
  subcategory_id: SUBCATEGORY.DEVOPS_INFRASTRUCTURE,
  source: "uber-eng",
  seeder_score: 0.75,
  maxArticles: 500,
  maxPages: 20,
});
