/**
 * seed-oceanexplorer-noaa.mjs — NOAA Ocean Explorer seeder
 * Category: CATEGORY.PEOPLE_PLACES → SUBCATEGORY.OCEANS_MARITIME
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "oceanexplorer.noaa.gov",
  cacheFileName: "oceanexplorer-noaa.json",
  displayName: "🌊 NOAA Ocean Explorer",
  feedUrl: "https://oceanexplorer.noaa.gov/news/rss/news.rss",
  articlePathRegex: /(explorations|news|okeanos)/,
  siteSuffixRegex: \s*[-–—]\s*oceanexplorer.noaa.gov\s*$,
  category_id: CATEGORY.PEOPLE_PLACES,
  subcategory_id: SUBCATEGORY.OCEANS_MARITIME,
  source: "oceanexplorer-noaa",
  seeder_score: 0.85,
  maxArticles: 500,
  maxPages: 20,
});
