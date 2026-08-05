/**
 * seed-bakken-museum.mjs — Bakken Museum seeder
 * Category: CATEGORY.HISTORY_IDEAS → SUBCATEGORY.HISTORY_SCIENCE_TECHNOLOGY
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "thebakken.org",
  cacheFileName: "bakken-museum.json",
  displayName: "⚡ Bakken Museum",
  feedUrl: "https://thebakken.org/feed/",
  articlePathRegex: /(programs|exhibits|about)/,
  siteSuffixRegex: \s*[-–—]\s*thebakken.org\s*$,
  category_id: CATEGORY.HISTORY_IDEAS,
  subcategory_id: SUBCATEGORY.HISTORY_SCIENCE_TECHNOLOGY,
  source: "bakken",
  seeder_score: 0.6,
  maxArticles: 500,
  maxPages: 20,
});
