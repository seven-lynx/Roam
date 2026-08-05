/**
 * seed-blackvault.mjs — The Black Vault seeder
 * Category: CATEGORY.WEIRD_WONDERFUL → SUBCATEGORY.FORTEANA_ANOMALIES
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.theblackvault.com",
  cacheFileName: "blackvault.json",
  displayName: "📁 The Black Vault",
  feedUrl: "https://www.theblackvault.com/documentarchive/feed/",
  articlePathRegex: /(casefiles|documentarchive|news)/,
  siteSuffixRegex: \s*[-–—]\s*theblackvault.com\s*$,
  category_id: CATEGORY.WEIRD_WONDERFUL,
  subcategory_id: SUBCATEGORY.FORTEANA_ANOMALIES,
  source: "blackvault",
  seeder_score: 0.65,
  maxArticles: 500,
  maxPages: 20,
});
