/**
 * seed-constitution-society.mjs — Constitution Society seeder
 * Category: CATEGORY.HISTORY_IDEAS → SUBCATEGORY.LEGAL_HISTORY_CONSTITUTIONAL
 * Access: Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.constitution.org",
  cacheFileName: "constitution-society.json",
  displayName: "🏛 Constitution Society",
  
  articlePathRegex: /(cons|lib|ps)/,
  siteSuffixRegex: \s*[-–—]\s*constitution.org\s*$,
  category_id: CATEGORY.HISTORY_IDEAS,
  subcategory_id: SUBCATEGORY.LEGAL_HISTORY_CONSTITUTIONAL,
  source: "constitution-society",
  seeder_score: 0.6,
  maxArticles: 500,
  maxPages: 20,
});
