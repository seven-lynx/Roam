/**
 * seed-flyfisherman.mjs — Fly Fisherman seeder
 * Fly fishing magazine with technique, destination, gear, and conservation content.
 * Category: GAMES_HOBBIES → FISHING
 * Multi-method: RSS → Sitemap → Wayback → RSS Auto
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.flyfisherman.com",
  cacheFileName: "flyfisherman.json",
  displayName: "🎣 Fly Fisherman",
  feedUrl: "https://www.flyfisherman.com/feed/",
  articlePathRegex: /\/(editorial|gear|techniques|destinations|conservation|tactics|beginners)\/[a-z0-9-]+$/i,
  siteSuffixRegex: /\s*[\|\-]\s*Fly\s+Fisherman\s*$/i,
  category_id: CATEGORY.GAMES_HOBBIES,
  subcategory_id: SUBCATEGORY.FISHING,
  source: "flyfisherman",
  seeder_score: 0.8,
  maxArticles: 1500,
  maxPages: 20,
});