/**
 * seed-on-the-water.mjs — On The Water seeder
 * Northeast fishing reports, techniques, gear, and destinations.
 * Category: GAMES_HOBBIES → FISHING
 * Multi-method: RSS → Sitemap → Wayback → RSS Auto
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.onthewater.com",
  cacheFileName: "on-the-water.json",
  displayName: "🌊 On The Water",
  feedUrl: "https://www.onthewater.com/feed/",
  articlePathRegex: /\/(fishing|boating|gear|techniques|reports|destinations|species)\/[a-z0-9-]+$/i,
  siteSuffixRegex: /\s*[\|\-]\s*On\s+The\s+Water\s*$/i,
  category_id: CATEGORY.GAMES_HOBBIES,
  subcategory_id: SUBCATEGORY.FISHING,
  source: "on-the-water",
  seeder_score: 0.8,
  maxArticles: 1500,
  maxPages: 15,
});