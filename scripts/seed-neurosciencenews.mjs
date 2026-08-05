/**
 * seed-neurosciencenews.mjs — Neuroscience News seeder
 * Category: CATEGORY.SCIENCE → SUBCATEGORY.NEUROSCIENCE_COGNITION
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "neurosciencenews.com",
  cacheFileName: "neurosciencenews.json",
  displayName: "🧠 Neuroscience News",
  feedUrl: "https://neurosciencenews.com/feed/",
  articlePathRegex: /(neuroscience|psychology|neurology|genetics|artificial-intelligence|robotics|neurotech)/,
  siteSuffixRegex: \s*[-–—]\s*neurosciencenews.com\s*$,
  category_id: CATEGORY.SCIENCE,
  subcategory_id: SUBCATEGORY.NEUROSCIENCE_COGNITION,
  source: "neurosciencenews",
  seeder_score: 0.75,
  maxArticles: 500,
  maxPages: 20,
});
