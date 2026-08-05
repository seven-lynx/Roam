/**
 * seed-theatre.mjs — Playbill seeder
 * Broadway and theatre news, reviews, interviews, and show coverage.
 * Category: ARTS_CULTURE → THEATRE_PERFORMANCE
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.playbill.com",
  cacheFileName: "playbill.json",
  displayName: "🎭 Playbill",
  feedUrl: "https://www.playbill.com/feed",
  articlePathRegex: /\/(article|news|video|feature|photo-story|podcast)\/[a-z0-9-]/i,
  siteSuffixRegex: /\s*\|\s*Playbill\s*$/i,
  category_id: CATEGORY.ARTS_CULTURE,
  subcategory_id: SUBCATEGORY.THEATRE_PERFORMANCE,
  source: "playbill",
  seeder_score: 0.6,
  maxArticles: 2000,
  maxPages: 20,
});