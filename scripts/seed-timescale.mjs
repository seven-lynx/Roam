/**
 * seed-timescale.mjs — Timescale seeder
 * Category: CATEGORY.TECHNOLOGY → SUBCATEGORY.DATABASES_DATA_ENGINEERING
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.timescale.com",
  cacheFileName: "timescale.json",
  displayName: "⏱ Timescale",
  feedUrl: "https://www.timescale.com/blog/feed/",
  articlePathRegex: /blog/,
  siteSuffixRegex: \s*[-–—]\s*timescale.com\s*$,
  category_id: CATEGORY.TECHNOLOGY,
  subcategory_id: SUBCATEGORY.DATABASES_DATA_ENGINEERING,
  source: "timescale",
  seeder_score: 0.7,
  maxArticles: 500,
  maxPages: 20,
});
