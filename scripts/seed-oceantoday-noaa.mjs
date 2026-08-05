/**
 * seed-oceantoday-noaa.mjs — Ocean Today seeder
 * Category: CATEGORY.PEOPLE_PLACES → SUBCATEGORY.OCEANS_MARITIME
 * Access: Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "oceantoday.noaa.gov",
  cacheFileName: "oceantoday-noaa.json",
  displayName: "📺 Ocean Today",
  
  articlePathRegex: /(fullmoon|videos)/,
  siteSuffixRegex: \s*[-–—]\s*oceantoday.noaa.gov\s*$,
  category_id: CATEGORY.PEOPLE_PLACES,
  subcategory_id: SUBCATEGORY.OCEANS_MARITIME,
  source: "oceantoday",
  seeder_score: 0.65,
  maxArticles: 500,
  maxPages: 20,
});
