/**
 * seed-apsnet.mjs — APSNet seeder
 * Category: CATEGORY.SCIENCE → SUBCATEGORY.BOTANY_PLANT_SCIENCE
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.apsnet.org",
  cacheFileName: "apsnet.json",
  displayName: "🦠 APSNet",
  feedUrl: "https://apsjournals.apsnet.org/loi/phyto.rss",
  articlePathRegex: /doi/,
  siteSuffixRegex: \s*[-–—]\s*apsnet.org\s*$,
  category_id: CATEGORY.SCIENCE,
  subcategory_id: SUBCATEGORY.BOTANY_PLANT_SCIENCE,
  source: "apsnet",
  seeder_score: 0.7,
  maxArticles: 500,
  maxPages: 20,
});
