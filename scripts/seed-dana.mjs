/**
 * seed-dana.mjs — Dana Foundation seeder
 * Category: CATEGORY.SCIENCE → SUBCATEGORY.NEUROSCIENCE_COGNITION
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "dana.org",
  cacheFileName: "dana.json",
  displayName: "🧠 Dana Foundation",
  feedUrl: "https://dana.org/feed/",
  articlePathRegex: /(article|news|resources)/,
  siteSuffixRegex: \s*[-–—]\s*dana.org\s*$,
  category_id: CATEGORY.SCIENCE,
  subcategory_id: SUBCATEGORY.NEUROSCIENCE_COGNITION,
  source: "dana",
  seeder_score: 0.65,
  maxArticles: 500,
  maxPages: 20,
});
