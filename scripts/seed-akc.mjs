/**
 * seed-akc.mjs — American Kennel Club seeder
 * Dog breeds, training, health, events, and responsible ownership.
 * Category: GAMES_HOBBIES → PETS
 * Multi-method: RSS → Sitemap → Wayback → RSS Auto
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.akc.org",
  cacheFileName: "akc.json",
  displayName: "🐕 AKC",
  feedUrl: "https://www.akc.org/feed/",
  articlePathRegex: /\/(expert-advice|breeds|dog-breeds|training|puppy|health|sports|events)\/[a-z0-9-]+$/i,
  siteSuffixRegex: /\s*[\|\-]\s*American\s+Kennel\s+Club\s*$/i,
  category_id: CATEGORY.GAMES_HOBBIES,
  subcategory_id: SUBCATEGORY.PETS,
  source: "akc",
  seeder_score: 0.8,
  maxArticles: 2000,
  maxPages: 25,
});