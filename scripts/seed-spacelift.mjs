/**
 * seed-spacelift.mjs — Spacelift seeder
 * Category: CATEGORY.TECHNOLOGY → SUBCATEGORY.DEVOPS_INFRASTRUCTURE
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "spacelift.io",
  cacheFileName: "spacelift.json",
  displayName: "🚀 Spacelift",
  feedUrl: "https://spacelift.io/blog/feed",
  articlePathRegex: /blog/,
  siteSuffixRegex: \s*[-–—]\s*spacelift.io\s*$,
  category_id: CATEGORY.TECHNOLOGY,
  subcategory_id: SUBCATEGORY.DEVOPS_INFRASTRUCTURE,
  source: "spacelift",
  seeder_score: 0.6,
  maxArticles: 500,
  maxPages: 20,
});
