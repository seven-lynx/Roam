/**
 * seed-nwf.mjs — National Wildlife Federation seeder
 * US wildlife conservation, gardening for wildlife, and nature education.
 * Category: GAMES_HOBBIES → PETS
 * Access: RSS feed
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.nwf.org",
  cacheFileName: "nwf.json",
  displayName: "🌿 NWF",
  feedUrl: "https://www.nwf.org/Feeds/RSS/Blogs",
  articlePathRegex: /\/[a-z0-9-]+\/[a-z0-9-]+\/?$/i,
  siteSuffixRegex: /\s*\|\s*National Wildlife Federation\s*$/i,
  category_id: CATEGORY.GAMES_HOBBIES,
  subcategory_id: SUBCATEGORY.PETS,
  source: "nwf",
  seeder_score: 0.75,
  maxArticles: 2000,
  maxPages: 20,
});