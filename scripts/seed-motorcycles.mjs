/**
 * seed-motorcycles.mjs — Motorcycles & Riding (RSS → Sitemap → Wayback)
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "rideapart.com",
  cacheFileName: "motorcycles.json",
  displayName: "🏍️ RideApart",
  feedUrl: "https://www.rideapart.com/feed/",
  articlePathRegex: /\/(news|articles|reviews|features|gear|how-to)\/[a-z0-9-]/i,
  siteSuffixRegex: /\s*[\|\-]\s*RideApart$/i,
  category_id: CATEGORY.GAMES_HOBBIES,
  subcategory_id: SUBCATEGORY.SPORTS_ATHLETICS,
  source: "motorcycles",
  maxArticles: 1000,
  maxPages: 15,
});