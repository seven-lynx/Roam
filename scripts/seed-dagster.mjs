/**
 * seed-dagster.mjs — Dagster seeder
 * Category: CATEGORY.TECHNOLOGY → SUBCATEGORY.DATABASES_DATA_ENGINEERING
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "dagster.io",
  cacheFileName: "dagster.json",
  displayName: "⚙ Dagster",
  feedUrl: "https://dagster.io/blog/rss.xml",
  articlePathRegex: /blog/,
  siteSuffixRegex: \s*[-–—]\s*dagster.io\s*$,
  category_id: CATEGORY.TECHNOLOGY,
  subcategory_id: SUBCATEGORY.DATABASES_DATA_ENGINEERING,
  source: "dagster",
  seeder_score: 0.65,
  maxArticles: 500,
  maxPages: 20,
});
