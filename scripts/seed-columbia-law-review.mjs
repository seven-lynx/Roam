/**
 * seed-columbia-law-review.mjs — Columbia Law Review seeder
 * Category: CATEGORY.HISTORY_IDEAS → SUBCATEGORY.LEGAL_HISTORY_CONSTITUTIONAL
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "columbialawreview.org",
  cacheFileName: "columbia-law-review.json",
  displayName: "📖 Columbia Law Review",
  feedUrl: "https://columbialawreview.org/feed/",
  articlePathRegex: /(content|article)/,
  siteSuffixRegex: \s*[-–—]\s*columbialawreview.org\s*$,
  category_id: CATEGORY.HISTORY_IDEAS,
  subcategory_id: SUBCATEGORY.LEGAL_HISTORY_CONSTITUTIONAL,
  source: "columbialawreview",
  seeder_score: 0.75,
  maxArticles: 500,
  maxPages: 20,
});
