/**
 * seed-biographic.mjs — bioGraphic seeder (California Academy of Sciences)
 * Wildlife photojournalism, conservation science, and natural history essays.
 * Category: GAMES_HOBBIES → PETS
 * Access: RSS feed
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.biographic.com",
  cacheFileName: "biographic.json",
  displayName: "📸 bioGraphic",
  feedUrl: "https://www.biographic.com/feed",
  articlePathRegex: /\/[a-z0-9-]+\/[a-z0-9-]+\/?$/i,
  siteSuffixRegex: /\s*\|\s*bioGraphic\s*$/i,
  category_id: CATEGORY.GAMES_HOBBIES,
  subcategory_id: SUBCATEGORY.PETS,
  source: "biographic",
  seeder_score: 0.85,
  maxArticles: 2000,
  maxPages: 20,
});