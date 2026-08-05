/**
 * seed-law-library-congress.mjs — Law Library of Congress seeder
 * Category: CATEGORY.HISTORY_IDEAS → SUBCATEGORY.LEGAL_HISTORY_CONSTITUTIONAL
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "blogs.loc.gov",
  cacheFileName: "law-library-congress.json",
  displayName: "📚 Law Library of Congress",
  feedUrl: "https://blogs.loc.gov/law/feed/",
  articlePathRegex: /law/,
  siteSuffixRegex: \s*[-–—]\s*blogs.loc.gov\s*$,
  category_id: CATEGORY.HISTORY_IDEAS,
  subcategory_id: SUBCATEGORY.LEGAL_HISTORY_CONSTITUTIONAL,
  source: "loc-law",
  seeder_score: 0.8,
  maxArticles: 500,
  maxPages: 20,
});
