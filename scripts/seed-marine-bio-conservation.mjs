/**
 * seed-marine-bio-conservation.mjs — Marine Bio Conservation seeder
 * Category: CATEGORY.PEOPLE_PLACES → SUBCATEGORY.OCEANS_MARITIME
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.marinebio.org",
  cacheFileName: "marine-bio-conservation.json",
  displayName: "🐚 Marine Bio Conservation",
  feedUrl: "https://www.marinebio.org/feed/",
  articlePathRegex: /(conservation|species|news)/,
  siteSuffixRegex: \s*[-–—]\s*marinebio.org\s*$,
  category_id: CATEGORY.PEOPLE_PLACES,
  subcategory_id: SUBCATEGORY.OCEANS_MARITIME,
  source: "marinebio",
  seeder_score: 0.7,
  maxArticles: 500,
  maxPages: 20,
});
