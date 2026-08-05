/**
 * seed-stanford-law-review.mjs — Stanford Law Review seeder
 * Category: CATEGORY.HISTORY_IDEAS → SUBCATEGORY.LEGAL_HISTORY_CONSTITUTIONAL
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.stanfordlawreview.org",
  cacheFileName: "stanford-law-review.json",
  displayName: "📖 Stanford Law Review",
  feedUrl: "https://www.stanfordlawreview.org/feed/",
  articlePathRegex: /(online|print)/,
  siteSuffixRegex: \s*[-–—]\s*stanfordlawreview.org\s*$,
  category_id: CATEGORY.HISTORY_IDEAS,
  subcategory_id: SUBCATEGORY.LEGAL_HISTORY_CONSTITUTIONAL,
  source: "stanfordlawreview",
  seeder_score: 0.8,
  maxArticles: 500,
  maxPages: 20,
});
