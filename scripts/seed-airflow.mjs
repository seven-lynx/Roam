/**
 * seed-airflow.mjs — Airflow seeder
 * Category: CATEGORY.TECHNOLOGY → SUBCATEGORY.DATABASES_DATA_ENGINEERING
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "airflow.apache.org",
  cacheFileName: "airflow.json",
  displayName: "💨 Airflow",
  feedUrl: "https://airflow.apache.org/blog/feed.xml",
  articlePathRegex: /blog/,
  siteSuffixRegex: \s*[-–—]\s*airflow.apache.org\s*$,
  category_id: CATEGORY.TECHNOLOGY,
  subcategory_id: SUBCATEGORY.DATABASES_DATA_ENGINEERING,
  source: "airflow",
  seeder_score: 0.75,
  maxArticles: 500,
  maxPages: 20,
});
