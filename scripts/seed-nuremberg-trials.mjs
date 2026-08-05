/**
 * seed-nuremberg-trials.mjs — Nuremberg Trials Project seeder
 * Category: CATEGORY.HISTORY_IDEAS → SUBCATEGORY.LEGAL_HISTORY_CONSTITUTIONAL
 * Access: Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "nuremberg.law.harvard.edu",
  cacheFileName: "nuremberg-trials.json",
  displayName: "📜 Nuremberg Trials Project",
  
  articlePathRegex: /(documents|transcripts)/,
  siteSuffixRegex: \s*[-–—]\s*nuremberg.law.harvard.edu\s*$,
  category_id: CATEGORY.HISTORY_IDEAS,
  subcategory_id: SUBCATEGORY.LEGAL_HISTORY_CONSTITUTIONAL,
  source: "nuremberg",
  seeder_score: 0.7,
  maxArticles: 500,
  maxPages: 20,
});
