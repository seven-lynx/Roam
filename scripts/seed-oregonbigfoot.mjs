/**
 * seed-oregonbigfoot.mjs — Oregon Bigfoot seeder
 * Category: CATEGORY.WEIRD_WONDERFUL → SUBCATEGORY.CRYPTOZOOLOGY_MYTHICAL
 * Access: Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.oregonbigfoot.com",
  cacheFileName: "oregonbigfoot.json",
  displayName: "👣 Oregon Bigfoot",
  
  articlePathRegex: /(sightings|reports|history)/,
  siteSuffixRegex: \s*[-–—]\s*oregonbigfoot.com\s*$,
  category_id: CATEGORY.WEIRD_WONDERFUL,
  subcategory_id: SUBCATEGORY.CRYPTOZOOLOGY_MYTHICAL,
  source: "oregonbigfoot",
  seeder_score: 0.45,
  maxArticles: 500,
  maxPages: 20,
});
