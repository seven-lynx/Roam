/**
 * seed-summitpost.mjs — SummitPost seeder
 * Category: CATEGORY.PEOPLE_PLACES → SUBCATEGORY.MOUNTAINS_ALPINE
 * Access: Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.summitpost.org",
  cacheFileName: "summitpost.json",
  displayName: "🏔 SummitPost",
  
  articlePathRegex: /(mountain|area|route)/,
  siteSuffixRegex: \s*[-–—]\s*summitpost.org\s*$,
  category_id: CATEGORY.PEOPLE_PLACES,
  subcategory_id: SUBCATEGORY.MOUNTAINS_ALPINE,
  source: "summitpost",
  seeder_score: 0.7,
  maxArticles: 500,
  maxPages: 20,
});
