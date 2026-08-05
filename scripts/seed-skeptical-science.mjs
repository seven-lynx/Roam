/**
 * seed-skeptical-science.mjs — Skeptical Science seeder
 * Category: CATEGORY.SCIENCE → SUBCATEGORY.CLIMATE_ATMOSPHERIC_SCIENCE
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "skepticalscience.com",
  cacheFileName: "skeptical-science.json",
  displayName: "🔍 Skeptical Science",
  feedUrl: "https://skepticalscience.com/feed.php",
  articlePathRegex: /(argument|news)/,
  siteSuffixRegex: \s*[-–—]\s*skepticalscience.com\s*$,
  category_id: CATEGORY.SCIENCE,
  subcategory_id: SUBCATEGORY.CLIMATE_ATMOSPHERIC_SCIENCE,
  source: "skepticalscience",
  seeder_score: 0.75,
  maxArticles: 500,
  maxPages: 20,
});
