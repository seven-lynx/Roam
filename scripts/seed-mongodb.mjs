/**
 * seed-mongodb.mjs — MongoDB seeder
 * Category: CATEGORY.TECHNOLOGY → SUBCATEGORY.DATABASES_DATA_ENGINEERING
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.mongodb.com",
  cacheFileName: "mongodb.json",
  displayName: "🍃 MongoDB",
  feedUrl: "https://www.mongodb.com/blog/rss.xml",
  articlePathRegex: /(blog|developer)/,
  siteSuffixRegex: \s*[-–—]\s*mongodb.com\s*$,
  category_id: CATEGORY.TECHNOLOGY,
  subcategory_id: SUBCATEGORY.DATABASES_DATA_ENGINEERING,
  source: "mongodb",
  seeder_score: 0.7,
  maxArticles: 500,
  maxPages: 20,
});
