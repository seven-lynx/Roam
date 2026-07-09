/**
 * seed-aspca.mjs — ASPCA seeder
 * Pet care, adoption, advocacy, and animal welfare from the ASPCA.
 * Category: GAMES_HOBBIES → PETS
 * Multi-method: RSS → Sitemap → Wayback → RSS Auto
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.aspca.org",
  cacheFileName: "aspca.json",
  displayName: "🐶 ASPCA",
  feedUrl: "https://www.aspca.org/news/feed",
  articlePathRegex: /\/(news|pet-care|animal-cruelty|adoption|dog-care|cat-care|horse-care|advocacy)\/[a-z0-9-]+$/i,
  siteSuffixRegex: /\s*[\|\-]\s*ASPCA\s*$/i,
  category_id: CATEGORY.GAMES_HOBBIES,
  subcategory_id: SUBCATEGORY.PETS,
  source: "aspca",
  seeder_score: 0.8,
  maxArticles: 1500,
  maxPages: 20,
});