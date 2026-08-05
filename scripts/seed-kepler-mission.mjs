/**
 * seed-kepler-mission.mjs — Kepler Mission seeder
 * Category: CATEGORY.SCIENCE → SUBCATEGORY.ASTROBIOLOGY_EXOPLANETS
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.nasa.gov",
  cacheFileName: "kepler-mission.json",
  displayName: "🛰 Kepler Mission",
  feedUrl: "https://www.nasa.gov/mission_pages/kepler/main/rss.xml",
  articlePathRegex: /mission_pages/kepler/,
  siteSuffixRegex: \s*[-–—]\s*nasa.gov\s*$,
  category_id: CATEGORY.SCIENCE,
  subcategory_id: SUBCATEGORY.ASTROBIOLOGY_EXOPLANETS,
  source: "kepler-mission",
  seeder_score: 0.85,
  maxArticles: 500,
  maxPages: 20,
});
