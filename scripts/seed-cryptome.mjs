/**
 * seed-cryptome.mjs — Cryptome seeder
 * Category: CATEGORY.TECHNOLOGY → SUBCATEGORY.CRYPTOGRAPHY_SECURITY
 * Access: Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "cryptome.org",
  cacheFileName: "cryptome.json",
  displayName: "📁 Cryptome",
  
  articlePathRegex: /d{4}/,
  siteSuffixRegex: \s*[-–—]\s*cryptome.org\s*$,
  category_id: CATEGORY.TECHNOLOGY,
  subcategory_id: SUBCATEGORY.CRYPTOGRAPHY_SECURITY,
  source: "cryptome",
  seeder_score: 0.65,
  maxArticles: 500,
  maxPages: 20,
});
