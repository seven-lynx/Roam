/**
 * seed-singlestore.mjs — SingleStore seeder
 * Category: CATEGORY.TECHNOLOGY → SUBCATEGORY.DATABASES_DATA_ENGINEERING
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.singlestore.com",
  cacheFileName: "singlestore.json",
  displayName: "⚡ SingleStore",
  feedUrl: "https://www.singlestore.com/blog/feed/",
  articlePathRegex: /blog/,
  siteSuffixRegex: \s*[-–—]\s*singlestore.com\s*$,
  category_id: CATEGORY.TECHNOLOGY,
  subcategory_id: SUBCATEGORY.DATABASES_DATA_ENGINEERING,
  source: "singlestore",
  seeder_score: 0.65,
  maxArticles: 500,
  maxPages: 20,
});
