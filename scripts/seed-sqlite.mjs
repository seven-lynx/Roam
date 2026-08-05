/**
 * seed-sqlite.mjs — SQLite seeder
 * Category: CATEGORY.TECHNOLOGY → SUBCATEGORY.DATABASES_DATA_ENGINEERING
 * Access: Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.sqlite.org",
  cacheFileName: "sqlite.json",
  displayName: "📦 SQLite",
  
  articlePathRegex: /(docs|draft|about)/,
  siteSuffixRegex: \s*[-–—]\s*sqlite.org\s*$,
  category_id: CATEGORY.TECHNOLOGY,
  subcategory_id: SUBCATEGORY.DATABASES_DATA_ENGINEERING,
  source: "sqlite",
  seeder_score: 0.7,
  maxArticles: 500,
  maxPages: 20,
});
