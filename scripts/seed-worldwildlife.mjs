/**
 * seed-worldwildlife.mjs — World Wildlife Fund seeder
 * Species conservation, habitat protection, wildlife journalism.
 * Category: GAMES_HOBBIES → PETS
 * Access: RSS feed
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.worldwildlife.org",
  cacheFileName: "worldwildlife.json",
  displayName: "🐼 WWF",
  feedUrl: "https://www.worldwildlife.org/rss.xml",
  articlePathRegex: /\/[a-z0-9-]+\/[a-z0-9-]+\/?$/i,
  siteSuffixRegex: /\s*\|\s*WWF\s*$/i,
  category_id: CATEGORY.GAMES_HOBBIES,
  subcategory_id: SUBCATEGORY.PETS,
  source: "worldwildlife",
  seeder_score: 0.8,
  maxArticles: 2000,
  maxPages: 20,
});