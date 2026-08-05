/**
 * seed-grafana.mjs — Grafana seeder
 * Category: CATEGORY.TECHNOLOGY → SUBCATEGORY.DATABASES_DATA_ENGINEERING
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "grafana.com",
  cacheFileName: "grafana.json",
  displayName: "📊 Grafana",
  feedUrl: "https://grafana.com/blog/index.xml",
  articlePathRegex: /blog/,
  siteSuffixRegex: \s*[-–—]\s*grafana.com\s*$,
  category_id: CATEGORY.TECHNOLOGY,
  subcategory_id: SUBCATEGORY.DATABASES_DATA_ENGINEERING,
  source: "grafana",
  seeder_score: 0.7,
  maxArticles: 500,
  maxPages: 20,
});
