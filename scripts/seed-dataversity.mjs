/**
 * seed-dataversity.mjs — DATAVERSITY seeder
 * Category: CATEGORY.TECHNOLOGY → SUBCATEGORY.DATABASES_DATA_ENGINEERING
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.dataversity.net",
  cacheFileName: "dataversity.json",
  displayName: "📚 DATAVERSITY",
  feedUrl: "https://www.dataversity.net/feed/",
  articlePathRegex: /(data-topics|category)/,
  siteSuffixRegex: \s*[-–—]\s*dataversity.net\s*$,
  category_id: CATEGORY.TECHNOLOGY,
  subcategory_id: SUBCATEGORY.DATABASES_DATA_ENGINEERING,
  source: "dataversity",
  seeder_score: 0.65,
  maxArticles: 500,
  maxPages: 20,
});
