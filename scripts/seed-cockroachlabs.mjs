/**
 * seed-cockroachlabs.mjs — CockroachDB seeder
 * Category: CATEGORY.TECHNOLOGY → SUBCATEGORY.DATABASES_DATA_ENGINEERING
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.cockroachlabs.com",
  cacheFileName: "cockroachlabs.json",
  displayName: "🪳 CockroachDB",
  feedUrl: "https://www.cockroachlabs.com/blog/index.xml",
  articlePathRegex: /blog/,
  siteSuffixRegex: \s*[-–—]\s*cockroachlabs.com\s*$,
  category_id: CATEGORY.TECHNOLOGY,
  subcategory_id: SUBCATEGORY.DATABASES_DATA_ENGINEERING,
  source: "cockroachlabs",
  seeder_score: 0.7,
  maxArticles: 500,
  maxPages: 20,
});
