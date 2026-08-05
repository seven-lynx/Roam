/**
 * seed-brainfacts.mjs — BrainFacts seeder
 * Category: CATEGORY.SCIENCE → SUBCATEGORY.NEUROSCIENCE_COGNITION
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.brainfacts.org",
  cacheFileName: "brainfacts.json",
  displayName: "🧠 BrainFacts",
  feedUrl: "https://www.brainfacts.org/rss.xml",
  articlePathRegex: /(thinking-sensing-and-behaving|diseases-and-disorders|brain-anatomy-and-function)/,
  siteSuffixRegex: \s*[-–—]\s*brainfacts.org\s*$,
  category_id: CATEGORY.SCIENCE,
  subcategory_id: SUBCATEGORY.NEUROSCIENCE_COGNITION,
  source: "brainfacts",
  seeder_score: 0.75,
  maxArticles: 500,
  maxPages: 20,
});
