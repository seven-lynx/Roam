/**
 * seed-hepper.mjs — Hepper seeder
 * Pet product reviews, breed guides, and pet lifestyle content.
 * Category: GAMES_HOBBIES → PETS
 * Access: RSS feed
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.hepper.com",
  cacheFileName: "hepper.json",
  displayName: "🐕 Hepper",
  feedUrl: "https://www.hepper.com/feed",
  articlePathRegex: /\/[a-z0-9-]+\/$/i,
  siteSuffixRegex: /[-–—]\s*Hepper\s*$/i,
  category_id: CATEGORY.GAMES_HOBBIES,
  subcategory_id: SUBCATEGORY.PETS,
  source: "hepper",
  seeder_score: 0.6,
  maxArticles: 1000,
  maxPages: 10,
});