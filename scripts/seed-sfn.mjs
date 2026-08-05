/**
 * seed-sfn.mjs — SfN seeder
 * Category: CATEGORY.SCIENCE → SUBCATEGORY.NEUROSCIENCE_COGNITION
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.sfn.org",
  cacheFileName: "sfn.json",
  displayName: "🧬 SfN",
  feedUrl: "https://www.sfn.org/rss/news",
  articlePathRegex: /(news|publications)/,
  siteSuffixRegex: \s*[-–—]\s*sfn.org\s*$,
  category_id: CATEGORY.SCIENCE,
  subcategory_id: SUBCATEGORY.NEUROSCIENCE_COGNITION,
  source: "sfn",
  seeder_score: 0.7,
  maxArticles: 500,
  maxPages: 20,
});
