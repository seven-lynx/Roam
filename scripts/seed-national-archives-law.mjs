/**
 * seed-national-archives-law.mjs — National Archives seeder
 * Category: CATEGORY.HISTORY_IDEAS → SUBCATEGORY.LEGAL_HISTORY_CONSTITUTIONAL
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.archives.gov",
  cacheFileName: "national-archives-law.json",
  displayName: "🏛 National Archives",
  feedUrl: "https://www.archives.gov/feed",
  articlePathRegex: /(news|research|milestone-documents)/,
  siteSuffixRegex: \s*[-–—]\s*archives.gov\s*$,
  category_id: CATEGORY.HISTORY_IDEAS,
  subcategory_id: SUBCATEGORY.LEGAL_HISTORY_CONSTITUTIONAL,
  source: "national-archives",
  seeder_score: 0.7,
  maxArticles: 500,
  maxPages: 20,
});
