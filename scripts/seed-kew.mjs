/**
 * seed-kew.mjs — Kew Gardens seeder
 * Category: CATEGORY.SCIENCE → SUBCATEGORY.BOTANY_PLANT_SCIENCE
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.kew.org",
  cacheFileName: "kew.json",
  displayName: "🌿 Kew Gardens",
  feedUrl: "https://www.kew.org/rss.xml",
  articlePathRegex: /(read-and-watch|science|news)/,
  siteSuffixRegex: \s*[-–—]\s*kew.org\s*$,
  category_id: CATEGORY.SCIENCE,
  subcategory_id: SUBCATEGORY.BOTANY_PLANT_SCIENCE,
  source: "kew",
  seeder_score: 0.9,
  maxArticles: 500,
  maxPages: 20,
});
