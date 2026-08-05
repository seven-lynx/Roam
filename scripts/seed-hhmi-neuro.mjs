/**
 * seed-hhmi-neuro.mjs — HHMI Neuro seeder
 * Category: CATEGORY.SCIENCE → SUBCATEGORY.NEUROSCIENCE_COGNITION
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.hhmi.org",
  cacheFileName: "hhmi-neuro.json",
  displayName: "🔬 HHMI Neuro",
  feedUrl: "https://www.hhmi.org/news/rss.xml",
  articlePathRegex: /(news|research)/,
  siteSuffixRegex: \s*[-–—]\s*hhmi.org\s*$,
  category_id: CATEGORY.SCIENCE,
  subcategory_id: SUBCATEGORY.NEUROSCIENCE_COGNITION,
  source: "hhmi-neuro",
  seeder_score: 0.75,
  maxArticles: 500,
  maxPages: 20,
});
