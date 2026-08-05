/**
 * seed-gardenista.mjs — Gardenista seeder
 * Garden design, planting guides, and outdoor landscape inspiration.
 * Category: GAMES_HOBBIES → GARDENING_HORTICULTURE
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.gardenista.com",
  cacheFileName: "gardenista.json",
  displayName: "🌿 Gardenista",
  feedUrl: "https://www.gardenista.com/feed/",
  articlePathRegex: /\/(posts|gardens|garden-design|plant-guide|outdoor|gardening-101)\/[a-z0-9-]/i,
  siteSuffixRegex: /\s*[-–—]\s*Gardenista\s*$/i,
  category_id: CATEGORY.GAMES_HOBBIES,
  subcategory_id: SUBCATEGORY.GARDENING_HORTICULTURE,
  source: "gardenista",
  seeder_score: 0.6,
  maxArticles: 1000,
  maxPages: 10,
});