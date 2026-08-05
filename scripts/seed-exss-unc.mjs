/**
 * seed-exss-unc.mjs — UNC EXSS seeder
 * Category: CATEGORY.MIND_BODY → SUBCATEGORY.HUMAN_PERFORMANCE
 * Access: Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "exss.unc.edu",
  cacheFileName: "exss-unc.json",
  displayName: "🎓 UNC EXSS",
  
  articlePathRegex: /(news|research|about)/,
  siteSuffixRegex: \s*[-–—]\s*exss.unc.edu\s*$,
  category_id: CATEGORY.MIND_BODY,
  subcategory_id: SUBCATEGORY.HUMAN_PERFORMANCE,
  source: "exss-unc",
  seeder_score: 0.6,
  maxArticles: 500,
  maxPages: 20,
});
