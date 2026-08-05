/**
 * seed-lii.mjs — LII Cornell seeder
 * Category: CATEGORY.HISTORY_IDEAS → SUBCATEGORY.LEGAL_HISTORY_CONSTITUTIONAL
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.law.cornell.edu",
  cacheFileName: "lii.json",
  displayName: "📚 LII Cornell",
  feedUrl: "https://www.law.cornell.edu/feeds/",
  articlePathRegex: /(wex|supct|constitution)/,
  siteSuffixRegex: \s*[-–—]\s*law.cornell.edu\s*$,
  category_id: CATEGORY.HISTORY_IDEAS,
  subcategory_id: SUBCATEGORY.LEGAL_HISTORY_CONSTITUTIONAL,
  source: "lii",
  seeder_score: 0.8,
  maxArticles: 500,
  maxPages: 20,
});
