/**
 * seed-cve.mjs — CVE seeder
 * Category: CATEGORY.TECHNOLOGY → SUBCATEGORY.CRYPTOGRAPHY_SECURITY
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "cve.mitre.org",
  cacheFileName: "cve.json",
  displayName: "🕳 CVE",
  feedUrl: "https://cve.mitre.org/news/rss.xml",
  articlePathRegex: /(cgi-bin|news)/,
  siteSuffixRegex: \s*[-–—]\s*cve.mitre.org\s*$,
  category_id: CATEGORY.TECHNOLOGY,
  subcategory_id: SUBCATEGORY.CRYPTOGRAPHY_SECURITY,
  source: "cve",
  seeder_score: 0.8,
  maxArticles: 500,
  maxPages: 20,
});
