/**
 * seed-animaldiversity.mjs — Animal Diversity Web seeder (U. Michigan)
 * Academic species accounts, taxonomy, and natural history of animals.
 * Category: GAMES_HOBBIES → PETS
 * Access: RSS feed
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "animaldiversity.org",
  cacheFileName: "animaldiversity.json",
  displayName: "🦎 Animal Diversity Web",
  feedUrl: "https://animaldiversity.org/site/feed/",
  articlePathRegex: /\/accounts\/[a-z_]+\/?$/i,
  siteSuffixRegex: /\s*[-–—]\s*Animal Diversity Web\s*$/i,
  category_id: CATEGORY.GAMES_HOBBIES,
  subcategory_id: SUBCATEGORY.PETS,
  source: "animaldiversity",
  seeder_score: 0.85,
  maxArticles: 2000,
  maxPages: 20,
});