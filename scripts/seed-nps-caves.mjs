/**
 * seed-nps-caves.mjs — NPS Caves seeder
 * Category: CATEGORY.WEIRD_WONDERFUL → SUBCATEGORY.UNDERGROUND_SUBTERRANEAN
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.nps.gov",
  cacheFileName: "nps-caves.json",
  displayName: "🏞 NPS Caves",
  feedUrl: "https://www.nps.gov/subjects/caves/index.htm",
  articlePathRegex: /(subjects|park)[a-z-]*/,
  siteSuffixRegex: \s*[-–—]\s*nps.gov\s*$,
  category_id: CATEGORY.WEIRD_WONDERFUL,
  subcategory_id: SUBCATEGORY.UNDERGROUND_SUBTERRANEAN,
  source: "nps-caves",
  seeder_score: 0.75,
  maxArticles: 500,
  maxPages: 20,
});
