/**
 * seed-legalhistoryblog.mjs — Legal History Blog seeder
 * Category: CATEGORY.HISTORY_IDEAS → SUBCATEGORY.LEGAL_HISTORY_CONSTITUTIONAL
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "legalhistoryblog.blogspot.com",
  cacheFileName: "legalhistoryblog.json",
  displayName: "📖 Legal History Blog",
  feedUrl: "https://legalhistoryblog.blogspot.com/feeds/posts/default",
  articlePathRegex: /d{4}/,
  siteSuffixRegex: \s*[-–—]\s*legalhistoryblog.blogspot.com\s*$,
  category_id: CATEGORY.HISTORY_IDEAS,
  subcategory_id: SUBCATEGORY.LEGAL_HISTORY_CONSTITUTIONAL,
  source: "legalhistoryblog",
  seeder_score: 0.75,
  maxArticles: 500,
  maxPages: 20,
});
