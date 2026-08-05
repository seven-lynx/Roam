/**
 * seed-allen-brain.mjs — Allen Institute seeder
 * Category: CATEGORY.SCIENCE → SUBCATEGORY.NEUROSCIENCE_COGNITION
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "alleninstitute.org",
  cacheFileName: "allen-brain.json",
  displayName: "🧠 Allen Institute",
  feedUrl: "https://alleninstitute.org/news/feed/",
  articlePathRegex: /(news|what-we-do)/,
  siteSuffixRegex: \s*[-–—]\s*alleninstitute.org\s*$,
  category_id: CATEGORY.SCIENCE,
  subcategory_id: SUBCATEGORY.NEUROSCIENCE_COGNITION,
  source: "allen-brain",
  seeder_score: 0.85,
  maxArticles: 500,
  maxPages: 20,
});
