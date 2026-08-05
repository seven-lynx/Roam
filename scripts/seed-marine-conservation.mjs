/**
 * seed-marine-conservation.mjs — Marine Conservation seeder
 * Category: CATEGORY.PEOPLE_PLACES → SUBCATEGORY.OCEANS_MARITIME
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.marineconservation.org.au",
  cacheFileName: "marine-conservation.json",
  displayName: "🐋 Marine Conservation",
  feedUrl: "https://www.marineconservation.org.au/feed/",
  articlePathRegex: /(news|resources|campaigns)/,
  siteSuffixRegex: \s*[-–—]\s*marineconservation.org.au\s*$,
  category_id: CATEGORY.PEOPLE_PLACES,
  subcategory_id: SUBCATEGORY.OCEANS_MARITIME,
  source: "marine-conservation",
  seeder_score: 0.65,
  maxArticles: 500,
  maxPages: 20,
});
