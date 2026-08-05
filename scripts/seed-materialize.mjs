/**
 * seed-materialize.mjs — Materialize seeder
 * Category: CATEGORY.TECHNOLOGY → SUBCATEGORY.DATABASES_DATA_ENGINEERING
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "materialize.com",
  cacheFileName: "materialize.json",
  displayName: "📡 Materialize",
  feedUrl: "https://materialize.com/blog/feed/",
  articlePathRegex: /blog/,
  siteSuffixRegex: \s*[-–—]\s*materialize.com\s*$,
  category_id: CATEGORY.TECHNOLOGY,
  subcategory_id: SUBCATEGORY.DATABASES_DATA_ENGINEERING,
  source: "materialize",
  seeder_score: 0.65,
  maxArticles: 500,
  maxPages: 20,
});
