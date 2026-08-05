/**
 * seed-iup-cryptozoology.mjs — IUP Cryptozoology seeder
 * Category: CATEGORY.WEIRD_WONDERFUL → SUBCATEGORY.CRYPTOZOOLOGY_MYTHICAL
 * Access: Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.iup.edu",
  cacheFileName: "iup-cryptozoology.json",
  displayName: "🎓 IUP Cryptozoology",
  
  articlePathRegex: /(cryptozoology|academics)/,
  siteSuffixRegex: \s*[-–—]\s*iup.edu\s*$,
  category_id: CATEGORY.WEIRD_WONDERFUL,
  subcategory_id: SUBCATEGORY.CRYPTOZOOLOGY_MYTHICAL,
  source: "iup-crypto",
  seeder_score: 0.55,
  maxArticles: 500,
  maxPages: 20,
});
