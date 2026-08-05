/**
 * seed-desertmuseum.mjs — Arizona-Sonora Desert Museum seeder
 * Category: CATEGORY.PEOPLE_PLACES → SUBCATEGORY.DESERTS_ARID_LANDS
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.desertmuseum.org",
  cacheFileName: "desertmuseum.json",
  displayName: "🌵 Arizona-Sonora Desert Museum",
  feedUrl: "https://www.desertmuseum.org/feed/",
  articlePathRegex: /(visit|programs|about)/,
  siteSuffixRegex: \s*[-–—]\s*desertmuseum.org\s*$,
  category_id: CATEGORY.PEOPLE_PLACES,
  subcategory_id: SUBCATEGORY.DESERTS_ARID_LANDS,
  source: "desertmuseum",
  seeder_score: 0.75,
  maxArticles: 500,
  maxPages: 20,
});
