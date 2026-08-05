/**
 * seed-desert-bg.mjs — Desert Botanical Garden seeder
 * Category: CATEGORY.SCIENCE → SUBCATEGORY.BOTANY_PLANT_SCIENCE
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.dbg.org",
  cacheFileName: "desert-bg.json",
  displayName: "🌵 Desert Botanical Garden",
  feedUrl: "https://www.dbg.org/feed/",
  articlePathRegex: /(blog|events|plants)/,
  siteSuffixRegex: \s*[-–—]\s*dbg.org\s*$,
  category_id: CATEGORY.SCIENCE,
  subcategory_id: SUBCATEGORY.BOTANY_PLANT_SCIENCE,
  source: "desert-bg",
  seeder_score: 0.65,
  maxArticles: 500,
  maxPages: 20,
});
