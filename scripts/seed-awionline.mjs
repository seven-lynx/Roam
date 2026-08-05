/**
 * seed-awionline.mjs — Animal Welfare Institute seeder
 * Nonprofit animal welfare, wildlife policy, and farm animal protection journalism.
 * Category: GAMES_HOBBIES → PETS
 * Access: RSS feed
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "awionline.org",
  cacheFileName: "awionline.json",
  displayName: "🐾 Animal Welfare Institute",
  feedUrl: "https://awionline.org/rss.xml",
  articlePathRegex: /\/[a-z0-9-]+\/[a-z0-9-]+\/?$/i,
  siteSuffixRegex: /\s*\|\s*Animal Welfare Institute\s*$/i,
  category_id: CATEGORY.GAMES_HOBBIES,
  subcategory_id: SUBCATEGORY.PETS,
  source: "awionline",
  seeder_score: 0.7,
  maxArticles: 2000,
  maxPages: 20,
});