/**
 * seed-magna-carta.mjs — Magna Carta Project seeder
 * Category: CATEGORY.HISTORY_IDEAS → SUBCATEGORY.LEGAL_HISTORY_CONSTITUTIONAL
 * Access: Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "magnacarta.cmp.uea.ac.uk",
  cacheFileName: "magna-carta.json",
  displayName: "📜 Magna Carta Project",
  
  articlePathRegex: /(read|feature_of_the_month)/,
  siteSuffixRegex: \s*[-–—]\s*magnacarta.cmp.uea.ac.uk\s*$,
  category_id: CATEGORY.HISTORY_IDEAS,
  subcategory_id: SUBCATEGORY.LEGAL_HISTORY_CONSTITUTIONAL,
  source: "magna-carta",
  seeder_score: 0.6,
  maxArticles: 500,
  maxPages: 20,
});
