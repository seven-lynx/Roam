/**
 * seed-ninds.mjs — NINDS seeder
 * Category: CATEGORY.SCIENCE → SUBCATEGORY.NEUROSCIENCE_COGNITION
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.ninds.nih.gov",
  cacheFileName: "ninds.json",
  displayName: "🔬 NINDS",
  feedUrl: "https://www.ninds.nih.gov/news-events/news-releases/feed",
  articlePathRegex: /(news-events|health-information)/,
  siteSuffixRegex: \s*[-–—]\s*ninds.nih.gov\s*$,
  category_id: CATEGORY.SCIENCE,
  subcategory_id: SUBCATEGORY.NEUROSCIENCE_COGNITION,
  source: "ninds",
  seeder_score: 0.85,
  maxArticles: 500,
  maxPages: 20,
});
