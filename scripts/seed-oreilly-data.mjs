/**
 * seed-oreilly-data.mjs — OReilly Data seeder
 * Category: CATEGORY.TECHNOLOGY → SUBCATEGORY.DATABASES_DATA_ENGINEERING
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.oreilly.com",
  cacheFileName: "oreilly-data.json",
  displayName: "📘 OReilly Data",
  feedUrl: "https://www.oreilly.com/radar/topics/data/feed/",
  articlePathRegex: /radar/,
  siteSuffixRegex: \s*[-–—]\s*oreilly.com\s*$,
  category_id: CATEGORY.TECHNOLOGY,
  subcategory_id: SUBCATEGORY.DATABASES_DATA_ENGINEERING,
  source: "oreilly-data",
  seeder_score: 0.7,
  maxArticles: 500,
  maxPages: 20,
});
