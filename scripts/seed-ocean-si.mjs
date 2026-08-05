/**
 * seed-ocean-si.mjs — Smithsonian Ocean seeder
 * Category: CATEGORY.PEOPLE_PLACES → SUBCATEGORY.OCEANS_MARITIME
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "ocean.si.edu",
  cacheFileName: "ocean-si.json",
  displayName: "🌊 Smithsonian Ocean",
  feedUrl: "https://ocean.si.edu/feed",
  articlePathRegex: /(ocean-life|planet-ocean|conservation)/,
  siteSuffixRegex: \s*[-–—]\s*ocean.si.edu\s*$,
  category_id: CATEGORY.PEOPLE_PLACES,
  subcategory_id: SUBCATEGORY.OCEANS_MARITIME,
  source: "ocean-si",
  seeder_score: 0.85,
  maxArticles: 500,
  maxPages: 20,
});
