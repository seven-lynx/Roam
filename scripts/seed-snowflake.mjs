/**
 * seed-snowflake.mjs — Snowflake seeder
 * Category: CATEGORY.TECHNOLOGY → SUBCATEGORY.DATABASES_DATA_ENGINEERING
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.snowflake.com",
  cacheFileName: "snowflake.json",
  displayName: "❄ Snowflake",
  feedUrl: "https://www.snowflake.com/blog/feed/",
  articlePathRegex: /(blog|guides)/,
  siteSuffixRegex: \s*[-–—]\s*snowflake.com\s*$,
  category_id: CATEGORY.TECHNOLOGY,
  subcategory_id: SUBCATEGORY.DATABASES_DATA_ENGINEERING,
  source: "snowflake",
  seeder_score: 0.7,
  maxArticles: 500,
  maxPages: 20,
});
