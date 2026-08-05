/**
 * seed-oceanographic.mjs — Oceanographic Magazine seeder
 * Marine wildlife photography, ocean exploration, and conservation features.
 * Category: GAMES_HOBBIES → PETS
 * Access: RSS feed
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "oceanographicmagazine.com",
  cacheFileName: "oceanographic.json",
  displayName: "🌊 Oceanographic Magazine",
  feedUrl: "https://oceanographicmagazine.com/feed",
  articlePathRegex: /\/[a-z0-9-]+\/[a-z0-9-]+\/?$/i,
  siteSuffixRegex: /\s*[-–—]\s*Oceanographic Magazine\s*$/i,
  category_id: CATEGORY.GAMES_HOBBIES,
  subcategory_id: SUBCATEGORY.PETS,
  source: "oceanographic",
  seeder_score: 0.8,
  maxArticles: 2000,
  maxPages: 20,
});