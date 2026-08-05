/**
 * seed-harvard-law-review.mjs — Harvard Law Review seeder
 * Category: CATEGORY.HISTORY_IDEAS → SUBCATEGORY.LEGAL_HISTORY_CONSTITUTIONAL
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "harvardlawreview.org",
  cacheFileName: "harvard-law-review.json",
  displayName: "📖 Harvard Law Review",
  feedUrl: "https://harvardlawreview.org/feed/",
  articlePathRegex: /print/,
  siteSuffixRegex: \s*[-–—]\s*harvardlawreview.org\s*$,
  category_id: CATEGORY.HISTORY_IDEAS,
  subcategory_id: SUBCATEGORY.LEGAL_HISTORY_CONSTITUTIONAL,
  source: "harvardlawreview",
  seeder_score: 0.8,
  maxArticles: 500,
  maxPages: 20,
});
