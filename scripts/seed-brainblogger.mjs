/**
 * seed-brainblogger.mjs — Brain Blogger seeder
 * Category: CATEGORY.SCIENCE → SUBCATEGORY.NEUROSCIENCE_COGNITION
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "brainblogger.com",
  cacheFileName: "brainblogger.json",
  displayName: "✍ Brain Blogger",
  feedUrl: "https://brainblogger.com/feed/",
  articlePathRegex: /d{4}/,
  siteSuffixRegex: \s*[-–—]\s*brainblogger.com\s*$,
  category_id: CATEGORY.SCIENCE,
  subcategory_id: SUBCATEGORY.NEUROSCIENCE_COGNITION,
  source: "brainblogger",
  seeder_score: 0.6,
  maxArticles: 500,
  maxPages: 20,
});
