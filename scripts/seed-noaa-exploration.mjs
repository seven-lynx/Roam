/**
 * seed-noaa-exploration.mjs — NOAA Ocean Exploration seeder
 * Category: CATEGORY.HISTORY_IDEAS → SUBCATEGORY.EXPLORATION_DISCOVERY
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "oceanexplorer.noaa.gov",
  cacheFileName: "noaa-exploration.json",
  displayName: "🌊 NOAA Ocean Exploration",
  feedUrl: "https://oceanexplorer.noaa.gov/news/rss/news.rss",
  articlePathRegex: /(explorations|news|okeanos)/,
  siteSuffixRegex: \s*[-–—]\s*oceanexplorer.noaa.gov\s*$,
  category_id: CATEGORY.HISTORY_IDEAS,
  subcategory_id: SUBCATEGORY.EXPLORATION_DISCOVERY,
  source: "noaa-exploration",
  seeder_score: 0.85,
  maxArticles: 500,
  maxPages: 20,
});
