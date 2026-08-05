/**
 * seed-justsecurity.mjs — Just Security seeder
 * Category: CATEGORY.HISTORY_IDEAS → SUBCATEGORY.LEGAL_HISTORY_CONSTITUTIONAL
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.justsecurity.org",
  cacheFileName: "justsecurity.json",
  displayName: "🛡 Just Security",
  feedUrl: "https://www.justsecurity.org/feed/",
  articlePathRegex: /d{4}/,
  siteSuffixRegex: \s*[-–—]\s*justsecurity.org\s*$,
  category_id: CATEGORY.HISTORY_IDEAS,
  subcategory_id: SUBCATEGORY.LEGAL_HISTORY_CONSTITUTIONAL,
  source: "justsecurity",
  seeder_score: 0.75,
  maxArticles: 500,
  maxPages: 20,
});
