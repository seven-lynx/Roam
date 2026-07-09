/**
 * seed-simpson-fly-fishing.mjs — Simpson Fly Fishing seeder
 * Fly fishing techniques, gear reviews, destinations, and conservation.
 * Category: GAMES_HOBBIES → FISHING
 * Multi-method: RSS → Sitemap → Wayback → RSS Auto
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "simpsonflyfishing.com",
  cacheFileName: "simpson-fly-fishing.json",
  displayName: "🎣 Simpson Fly Fishing",
  articlePathRegex: /\/(blog|techniques|gear|destinations|conservation|tying|reviews)\/[a-z0-9-]+$/i,
  siteSuffixRegex: /\s*[\|\-]\s*Simpson\s+Fly\s+Fishing\s*$/i,
  category_id: CATEGORY.GAMES_HOBBIES,
  subcategory_id: SUBCATEGORY.FISHING,
  source: "simpson-fly-fishing",
  seeder_score: 0.7,
  maxPages: 10,
});