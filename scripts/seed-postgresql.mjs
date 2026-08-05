/**
 * seed-postgresql.mjs — PostgreSQL seeder
 * Category: CATEGORY.TECHNOLOGY → SUBCATEGORY.DATABASES_DATA_ENGINEERING
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.postgresql.org",
  cacheFileName: "postgresql.json",
  displayName: "🐘 PostgreSQL",
  feedUrl: "https://www.postgresql.org/feed/news/",
  articlePathRegex: /(about|docs)/,
  siteSuffixRegex: \s*[-–—]\s*postgresql.org\s*$,
  category_id: CATEGORY.TECHNOLOGY,
  subcategory_id: SUBCATEGORY.DATABASES_DATA_ENGINEERING,
  source: "postgresql",
  seeder_score: 0.8,
  maxArticles: 500,
  maxPages: 20,
});
