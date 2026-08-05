/**
 * seed-cattledog.mjs — CattleDog Publishing seeder
 * Dog training, behavior, and veterinary science from Dr. Sophia Yin's legacy.
 * Category: GAMES_HOBBIES → PETS
 * Multi-method: RSS → Sitemap → Wayback → RSS Auto
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "cattledogpublishing.com",
  cacheFileName: "cattledog.json",
  displayName: "🐾 CattleDog Publishing",
  feedUrl: "https://cattledogpublishing.com/feed/",
  articlePathRegex: /\/(blog|training|behavior|veterinary|handling|puppy)\/[a-z0-9-]+$/i,
  siteSuffixRegex: /\s*[\|\-]\s*CattleDog\s+Publishing\s*$/i,
  category_id: CATEGORY.GAMES_HOBBIES,
  subcategory_id: SUBCATEGORY.PETS,
  source: "cattledog",
  seeder_score: 0.8,
  maxPages: 15,
});