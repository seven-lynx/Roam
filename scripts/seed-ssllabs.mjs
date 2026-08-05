/**
 * seed-ssllabs.mjs — SSL Labs seeder
 * Category: CATEGORY.TECHNOLOGY → SUBCATEGORY.CRYPTOGRAPHY_SECURITY
 * Access: Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.ssllabs.com",
  cacheFileName: "ssllabs.json",
  displayName: "🔒 SSL Labs",
  
  articlePathRegex: /(downloads|projects)/,
  siteSuffixRegex: \s*[-–—]\s*ssllabs.com\s*$,
  category_id: CATEGORY.TECHNOLOGY,
  subcategory_id: SUBCATEGORY.CRYPTOGRAPHY_SECURITY,
  source: "ssllabs",
  seeder_score: 0.7,
  maxArticles: 500,
  maxPages: 20,
});
