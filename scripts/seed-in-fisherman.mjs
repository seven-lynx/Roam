/**
 * seed-in-fisherman.mjs — In-Fisherman seeder
 * Freshwater fishing: bass, walleye, pike, panfish, catfish techniques and science.
 * Category: GAMES_HOBBIES → FISHING
 * Multi-method: RSS → Sitemap → Wayback → RSS Auto
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.in-fisherman.com",
  cacheFileName: "in-fisherman.json",
  displayName: "🐠 In-Fisherman",
  feedUrl: "https://www.in-fisherman.com/feed/",
  articlePathRegex: /\/(editorial|bass|walleye|pike-muskie|panfish|catfish|ice-fishing|gear|techniques)\/[a-z0-9-]+$/i,
  siteSuffixRegex: /\s*[\|\-]\s*In-Fisherman\s*$/i,
  category_id: CATEGORY.GAMES_HOBBIES,
  subcategory_id: SUBCATEGORY.FISHING,
  source: "in-fisherman",
  seeder_score: 0.8,
  maxArticles: 1500,
  maxPages: 20,
});