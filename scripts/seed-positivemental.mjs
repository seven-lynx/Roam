/**
 * seed-positivemental.mjs — Greater Good Science Center seeder
 * Science-based articles on happiness, resilience, compassion, and mental well-being.
 * Category: MIND_BODY → MENTAL_HEALTH
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "greatergood.berkeley.edu",
  cacheFileName: "greatergood.json",
  displayName: "🌈 Greater Good",
  feedUrl: "https://greatergood.berkeley.edu/feeds/rss",
  articlePathRegex: /\/(article|podcast|video|quiz|topic)\/[a-z0-9-]/i,
  siteSuffixRegex: /\s*[-–—]\s*Greater\s+Good\s*$/i,
  category_id: CATEGORY.MIND_BODY,
  subcategory_id: SUBCATEGORY.MENTAL_HEALTH,
  source: "greatergood",
  seeder_score: 0.65,
  maxArticles: 1500,
  maxPages: 15,
});