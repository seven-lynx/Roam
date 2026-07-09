/**
 * seed-wired2fish.mjs — Wired2Fish seeder
 * Bass fishing techniques, tackle reviews, electronics, and tournament coverage.
 * Category: GAMES_HOBBIES → FISHING
 * Multi-method: RSS → Sitemap → Wayback → RSS Auto
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.wired2fish.com",
  cacheFileName: "wired2fish.json",
  displayName: "🎣 Wired2Fish",
  feedUrl: "https://www.wired2fish.com/feed/",
  articlePathRegex: /\/(fishing-tips|bass-fishing|gear|electronics|boats|tackle|reviews)\/[a-z0-9-]+$/i,
  siteSuffixRegex: /\s*[\|\-]\s*Wired2Fish\s*$/i,
  category_id: CATEGORY.GAMES_HOBBIES,
  subcategory_id: SUBCATEGORY.FISHING,
  source: "wired2fish",
  seeder_score: 0.8,
  maxArticles: 1500,
  maxPages: 20,
});