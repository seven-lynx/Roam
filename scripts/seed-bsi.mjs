/**
 * seed-bsi.mjs — BSI seeder
 * Category: CATEGORY.TECHNOLOGY → SUBCATEGORY.CRYPTOGRAPHY_SECURITY
 * Access: Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.bsi.bund.de",
  cacheFileName: "bsi.json",
  displayName: "🇩🇪 BSI",
  
  articlePathRegex: /(DE|EN)/Themen/,
  siteSuffixRegex: \s*[-–—]\s*bsi.bund.de\s*$,
  category_id: CATEGORY.TECHNOLOGY,
  subcategory_id: SUBCATEGORY.CRYPTOGRAPHY_SECURITY,
  source: "bsi",
  seeder_score: 0.6,
  maxArticles: 500,
  maxPages: 20,
});
