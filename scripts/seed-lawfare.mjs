/**
 * seed-lawfare.mjs — Lawfare seeder
 * Category: CATEGORY.HISTORY_IDEAS → SUBCATEGORY.LEGAL_HISTORY_CONSTITUTIONAL
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.lawfaremedia.org",
  cacheFileName: "lawfare.json",
  displayName: "⚖ Lawfare",
  feedUrl: "https://www.lawfaremedia.org/feed",
  articlePathRegex: /(article|analysis)/,
  siteSuffixRegex: \s*[-–—]\s*lawfaremedia.org\s*$,
  category_id: CATEGORY.HISTORY_IDEAS,
  subcategory_id: SUBCATEGORY.LEGAL_HISTORY_CONSTITUTIONAL,
  source: "lawfare",
  seeder_score: 0.8,
  maxArticles: 500,
  maxPages: 20,
});
