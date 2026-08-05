/**
 * seed-ncsc.mjs — NCSC seeder
 * Category: CATEGORY.TECHNOLOGY → SUBCATEGORY.CRYPTOGRAPHY_SECURITY
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.ncsc.gov.uk",
  cacheFileName: "ncsc.json",
  displayName: "🇬🇧 NCSC",
  feedUrl: "https://www.ncsc.gov.uk/feeds/news.xml",
  articlePathRegex: /(news|guidance|information)/,
  siteSuffixRegex: \s*[-–—]\s*ncsc.gov.uk\s*$,
  category_id: CATEGORY.TECHNOLOGY,
  subcategory_id: SUBCATEGORY.CRYPTOGRAPHY_SECURITY,
  source: "ncsc",
  seeder_score: 0.8,
  maxArticles: 500,
  maxPages: 20,
});
