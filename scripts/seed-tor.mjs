/**
 * seed-tor.mjs — Tor.com seeder
 * Sci-fi & fantasy fiction, reviews, and commentary.
 * Category: ARTS_CULTURE → SCIFI_FANTASY
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "tor.com",
  cacheFileName: "tor.json",
  displayName: "🚀 Tor.com",
  feedUrl: "https://www.tor.com/feed/",
  articlePathRegex: /\/(\d{4}\/\d{2}|category|tag|books|reviews)\//i,
  siteSuffixRegex: /\s*\|\s*Tor\.com\s*$/i,
  category_id: CATEGORY.ARTS_CULTURE,
  subcategory_id: SUBCATEGORY.SCIFI_FANTASY,
  source: "tor",
  seeder_score: 0.65,
  maxArticles: 2000,
});