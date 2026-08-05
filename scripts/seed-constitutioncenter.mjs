/**
 * seed-constitutioncenter.mjs — Constitution Center seeder
 * Category: CATEGORY.HISTORY_IDEAS → SUBCATEGORY.LEGAL_HISTORY_CONSTITUTIONAL
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "constitutioncenter.org",
  cacheFileName: "constitutioncenter.json",
  displayName: "🏛 Constitution Center",
  feedUrl: "https://constitutioncenter.org/feed",
  articlePathRegex: /(blog|news|education)/,
  siteSuffixRegex: \s*[-–—]\s*constitutioncenter.org\s*$,
  category_id: CATEGORY.HISTORY_IDEAS,
  subcategory_id: SUBCATEGORY.LEGAL_HISTORY_CONSTITUTIONAL,
  source: "constitutioncenter",
  seeder_score: 0.75,
  maxArticles: 500,
  maxPages: 20,
});
