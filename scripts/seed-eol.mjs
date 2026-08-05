/**
 * seed-eol.mjs — Encyclopedia of Life seeder (Smithsonian)
 * Biodiversity portal with species pages, taxonomy, and natural history media.
 * Category: GAMES_HOBBIES → PETS
 * Access: RSS feed
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "eol.org",
  cacheFileName: "eol.json",
  displayName: "📖 Encyclopedia of Life",
  feedUrl: "https://eol.org/feed/news",
  articlePathRegex: /\/[a-z0-9-]+\/[a-z0-9-]+\/?$/i,
  siteSuffixRegex: /\s*\|\s*EOL\s*$/i,
  category_id: CATEGORY.GAMES_HOBBIES,
  subcategory_id: SUBCATEGORY.PETS,
  source: "eol",
  seeder_score: 0.8,
  maxArticles: 2000,
  maxPages: 20,
});