/**
 * seed-arizona-desert-museum.mjs — Arizona Desert Museum seeder
 * Category: CATEGORY.PEOPLE_PLACES → SUBCATEGORY.DESERTS_ARID_LANDS
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.arizonasonoradesertmuseum.com",
  cacheFileName: "arizona-desert-museum.json",
  displayName: "🌵 Arizona Desert Museum",
  feedUrl: "https://www.arizonasonoradesertmuseum.com/feed/",
  articlePathRegex: /(news|exhibits|about)/,
  siteSuffixRegex: \s*[-–—]\s*arizonasonoradesertmuseum.com\s*$,
  category_id: CATEGORY.PEOPLE_PLACES,
  subcategory_id: SUBCATEGORY.DESERTS_ARID_LANDS,
  source: "arizona-desert-museum",
  seeder_score: 0.65,
  maxArticles: 500,
  maxPages: 20,
});
