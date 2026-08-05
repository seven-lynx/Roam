/**
 * seed-urbex-co-uk.mjs — Urbex UK seeder
 * Category: CATEGORY.WEIRD_WONDERFUL → SUBCATEGORY.UNDERGROUND_SUBTERRANEAN
 * Access: Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.urbex.co.uk",
  cacheFileName: "urbex-co-uk.json",
  displayName: "📸 Urbex UK",
  
  articlePathRegex: /(locations|blog|galleries)/,
  siteSuffixRegex: \s*[-–—]\s*urbex.co.uk\s*$,
  category_id: CATEGORY.WEIRD_WONDERFUL,
  subcategory_id: SUBCATEGORY.UNDERGROUND_SUBTERRANEAN,
  source: "urbex-uk",
  seeder_score: 0.5,
  maxArticles: 500,
  maxPages: 20,
});
