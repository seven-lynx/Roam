/**
 * seed-gobi-desert.mjs — Gobi Desert seeder
 * Category: CATEGORY.PEOPLE_PLACES → SUBCATEGORY.DESERTS_ARID_LANDS
 * Access: Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.gobidesert.org",
  cacheFileName: "gobi-desert.json",
  displayName: "🏜 Gobi Desert",
  
  articlePathRegex: /(facts|animals|plants)/,
  siteSuffixRegex: \s*[-–—]\s*gobidesert.org\s*$,
  category_id: CATEGORY.PEOPLE_PLACES,
  subcategory_id: SUBCATEGORY.DESERTS_ARID_LANDS,
  source: "gobi-desert",
  seeder_score: 0.5,
  maxArticles: 500,
  maxPages: 20,
});
