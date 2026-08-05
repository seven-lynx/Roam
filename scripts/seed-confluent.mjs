/**
 * seed-confluent.mjs — Confluent seeder
 * Category: CATEGORY.TECHNOLOGY → SUBCATEGORY.DATABASES_DATA_ENGINEERING
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.confluent.io",
  cacheFileName: "confluent.json",
  displayName: "📨 Confluent",
  feedUrl: "https://www.confluent.io/blog/feed/",
  articlePathRegex: /blog/,
  siteSuffixRegex: \s*[-–—]\s*confluent.io\s*$,
  category_id: CATEGORY.TECHNOLOGY,
  subcategory_id: SUBCATEGORY.DATABASES_DATA_ENGINEERING,
  source: "confluent",
  seeder_score: 0.75,
  maxArticles: 500,
  maxPages: 20,
});
