/**
 * seed-citus-data.mjs — Citus Data seeder
 * Category: CATEGORY.TECHNOLOGY → SUBCATEGORY.DATABASES_DATA_ENGINEERING
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.citusdata.com",
  cacheFileName: "citus-data.json",
  displayName: "🏗 Citus Data",
  feedUrl: "https://www.citusdata.com/feed/",
  articlePathRegex: /blog/,
  siteSuffixRegex: \s*[-–—]\s*citusdata.com\s*$,
  category_id: CATEGORY.TECHNOLOGY,
  subcategory_id: SUBCATEGORY.DATABASES_DATA_ENGINEERING,
  source: "citusdata",
  seeder_score: 0.7,
  maxArticles: 500,
  maxPages: 20,
});
