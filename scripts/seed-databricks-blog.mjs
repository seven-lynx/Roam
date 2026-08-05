/**
 * seed-databricks-blog.mjs — Databricks seeder
 * Category: CATEGORY.TECHNOLOGY → SUBCATEGORY.DATABASES_DATA_ENGINEERING
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.databricks.com",
  cacheFileName: "databricks-blog.json",
  displayName: "🧱 Databricks",
  feedUrl: "https://www.databricks.com/blog/feed",
  articlePathRegex: /blog/,
  siteSuffixRegex: \s*[-–—]\s*databricks.com\s*$,
  category_id: CATEGORY.TECHNOLOGY,
  subcategory_id: SUBCATEGORY.DATABASES_DATA_ENGINEERING,
  source: "databricks",
  seeder_score: 0.75,
  maxArticles: 500,
  maxPages: 20,
});
