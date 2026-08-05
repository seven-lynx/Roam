/**
 * seed-us-cert.mjs — CISA seeder
 * Category: CATEGORY.TECHNOLOGY → SUBCATEGORY.CRYPTOGRAPHY_SECURITY
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.cisa.gov",
  cacheFileName: "us-cert.json",
  displayName: "🛡 CISA",
  feedUrl: "https://www.cisa.gov/uscert/ncas/alerts.xml",
  articlePathRegex: /(news-events|uscert)/,
  siteSuffixRegex: \s*[-–—]\s*cisa.gov\s*$,
  category_id: CATEGORY.TECHNOLOGY,
  subcategory_id: SUBCATEGORY.CRYPTOGRAPHY_SECURITY,
  source: "us-cert",
  seeder_score: 0.85,
  maxArticles: 500,
  maxPages: 20,
});
