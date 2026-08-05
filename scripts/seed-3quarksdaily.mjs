/**
 * seed-3quarksdaily.mjs — 3 Quarks Daily seeder
 * Category: CATEGORY.HISTORY_IDEAS → SUBCATEGORY.CULTURAL_INTELLECTUAL_HISTORY
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "3quarksdaily.com",
  cacheFileName: "3quarksdaily.json",
  displayName: "📰 3 Quarks Daily",
  feedUrl: "https://3quarksdaily.com/feed",
  articlePathRegex: /d{4}/,
  siteSuffixRegex: \s*[-–—]\s*3quarksdaily.com\s*$,
  category_id: CATEGORY.HISTORY_IDEAS,
  subcategory_id: SUBCATEGORY.CULTURAL_INTELLECTUAL_HISTORY,
  source: "3quarksdaily",
  seeder_score: 0.7,
  maxArticles: 500,
  maxPages: 20,
});
