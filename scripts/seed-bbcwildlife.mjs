/**
 * seed-bbcwildlife.mjs — BBC Wildlife Magazine seeder
 * UK wildlife journalism, photography, and natural history features.
 * Category: GAMES_HOBBIES → PETS
 * Access: RSS feed
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.discoverwildlife.com",
  cacheFileName: "bbcwildlife.json",
  displayName: "🦊 BBC Wildlife",
  feedUrl: "https://www.discoverwildlife.com/feed",
  articlePathRegex: /\/[a-z0-9-]+\/[a-z0-9-]+\/?$/i,
  siteSuffixRegex: /\s*\|\s*Discover Wildlife\s*$/i,
  category_id: CATEGORY.GAMES_HOBBIES,
  subcategory_id: SUBCATEGORY.PETS,
  source: "bbcwildlife",
  seeder_score: 0.8,
  maxArticles: 2000,
  maxPages: 20,
});