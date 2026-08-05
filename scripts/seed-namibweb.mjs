/**
 * seed-namibweb.mjs — NamibWeb seeder
 * Category: CATEGORY.PEOPLE_PLACES → SUBCATEGORY.DESERTS_ARID_LANDS
 * Access: Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.namibweb.com",
  cacheFileName: "namibweb.json",
  displayName: "🏜 NamibWeb",
  
  articlePathRegex: /(plants|animals|geography)/,
  siteSuffixRegex: \s*[-–—]\s*namibweb.com\s*$,
  category_id: CATEGORY.PEOPLE_PLACES,
  subcategory_id: SUBCATEGORY.DESERTS_ARID_LANDS,
  source: "namibweb",
  seeder_score: 0.55,
  maxArticles: 500,
  maxPages: 20,
});
