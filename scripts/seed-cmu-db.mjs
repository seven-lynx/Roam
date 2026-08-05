/**
 * seed-cmu-db.mjs — CMU Database Group seeder
 * Category: CATEGORY.TECHNOLOGY → SUBCATEGORY.DATABASES_DATA_ENGINEERING
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "db.cs.cmu.edu",
  cacheFileName: "cmu-db.json",
  displayName: "🎓 CMU Database Group",
  feedUrl: "https://db.cs.cmu.edu/feeds/blog.shtml",
  articlePathRegex: /(blog|seminar|project)/,
  siteSuffixRegex: \s*[-–—]\s*db.cs.cmu.edu\s*$,
  category_id: CATEGORY.TECHNOLOGY,
  subcategory_id: SUBCATEGORY.DATABASES_DATA_ENGINEERING,
  source: "cmu-db",
  seeder_score: 0.8,
  maxArticles: 500,
  maxPages: 20,
});
