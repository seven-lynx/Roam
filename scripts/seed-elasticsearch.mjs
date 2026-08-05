/**
 * seed-elasticsearch.mjs — Elasticsearch seeder
 * Category: CATEGORY.TECHNOLOGY → SUBCATEGORY.DATABASES_DATA_ENGINEERING
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.elastic.co",
  cacheFileName: "elasticsearch.json",
  displayName: "🔍 Elasticsearch",
  feedUrl: "https://www.elastic.co/blog/feed/",
  articlePathRegex: /blog/,
  siteSuffixRegex: \s*[-–—]\s*elastic.co\s*$,
  category_id: CATEGORY.TECHNOLOGY,
  subcategory_id: SUBCATEGORY.DATABASES_DATA_ENGINEERING,
  source: "elasticsearch",
  seeder_score: 0.7,
  maxArticles: 500,
  maxPages: 20,
});
