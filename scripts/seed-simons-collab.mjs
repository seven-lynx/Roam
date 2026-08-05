/**
 * seed-simons-collab.mjs — Simons Foundation seeder
 * Category: CATEGORY.SCIENCE → SUBCATEGORY.NEUROSCIENCE_COGNITION
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.simonsfoundation.org",
  cacheFileName: "simons-collab.json",
  displayName: "🔬 Simons Foundation",
  feedUrl: "https://www.simonsfoundation.org/feed/",
  articlePathRegex: /d{4}/,
  siteSuffixRegex: \s*[-–—]\s*simonsfoundation.org\s*$,
  category_id: CATEGORY.SCIENCE,
  subcategory_id: SUBCATEGORY.NEUROSCIENCE_COGNITION,
  source: "simons-collab",
  seeder_score: 0.75,
  maxArticles: 500,
  maxPages: 20,
});
