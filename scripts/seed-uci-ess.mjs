/**
 * seed-uci-ess.mjs — UCI ESS seeder
 * Category: CATEGORY.SCIENCE → SUBCATEGORY.CLIMATE_ATMOSPHERIC_SCIENCE
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "ess.uci.edu",
  cacheFileName: "uci-ess.json",
  displayName: "🔬 UCI ESS",
  feedUrl: "https://ess.uci.edu/news/rss",
  articlePathRegex: /(news|research)/,
  siteSuffixRegex: \s*[-–—]\s*ess.uci.edu\s*$,
  category_id: CATEGORY.SCIENCE,
  subcategory_id: SUBCATEGORY.CLIMATE_ATMOSPHERIC_SCIENCE,
  source: "uci-ess",
  seeder_score: 0.65,
  maxArticles: 500,
  maxPages: 20,
});
