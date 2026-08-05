/**
 * seed-offensive-security.mjs — Offensive Security seeder
 * Category: CATEGORY.TECHNOLOGY → SUBCATEGORY.CRYPTOGRAPHY_SECURITY
 * Access: Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.offensive-security.com",
  cacheFileName: "offensive-security.json",
  displayName: "💀 Offensive Security",
  
  articlePathRegex: /(blog|learn|resources)/,
  siteSuffixRegex: \s*[-–—]\s*offensive-security.com\s*$,
  category_id: CATEGORY.TECHNOLOGY,
  subcategory_id: SUBCATEGORY.CRYPTOGRAPHY_SECURITY,
  source: "offensive-security",
  seeder_score: 0.65,
  maxArticles: 500,
  maxPages: 20,
});
