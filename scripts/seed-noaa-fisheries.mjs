/**
 * seed-noaa-fisheries.mjs — NOAA Fisheries seeder
 * Marine mammal science, sustainable fisheries, and ocean wildlife research.
 * Category: GAMES_HOBBIES → PETS
 * Access: RSS feed
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.fisheries.noaa.gov",
  cacheFileName: "noaa-fisheries.json",
  displayName: "🐋 NOAA Fisheries",
  feedUrl: "https://www.fisheries.noaa.gov/rss/feature-stories",
  articlePathRegex: /\/[a-z0-9-]+\/[a-z0-9-]+\/?$/i,
  siteSuffixRegex: /\s*\|\s*NOAA Fisheries\s*$/i,
  category_id: CATEGORY.GAMES_HOBBIES,
  subcategory_id: SUBCATEGORY.PETS,
  source: "noaa",
  seeder_score: 0.75,
  maxArticles: 2000,
  maxPages: 20,
});