/**
 * seed-usgs.mjs — USGS seeder
 * Wildlife health, ecosystem science, and natural resource research.
 * Category: GAMES_HOBBIES → PETS
 * Access: RSS feed
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.usgs.gov",
  cacheFileName: "usgs.json",
  displayName: "🔬 USGS Wildlife",
  feedUrl: "https://www.usgs.gov/news/featured-stories/feed",
  articlePathRegex: /\/[a-z0-9-]+\/[a-z0-9-]+\/?$/i,
  siteSuffixRegex: /\s*\|\s*U\.S\. Geological Survey\s*$/i,
  category_id: CATEGORY.GAMES_HOBBIES,
  subcategory_id: SUBCATEGORY.PETS,
  source: "usgs",
  seeder_score: 0.75,
  maxArticles: 2000,
  maxPages: 20,
});