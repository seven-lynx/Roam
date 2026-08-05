/**
 * seed-janelia.mjs — Janelia seeder
 * Category: CATEGORY.SCIENCE → SUBCATEGORY.NEUROSCIENCE_COGNITION
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.janelia.org",
  cacheFileName: "janelia.json",
  displayName: "🔬 Janelia",
  feedUrl: "https://www.janelia.org/news/feed",
  articlePathRegex: /(news|research|publication)/,
  siteSuffixRegex: \s*[-–—]\s*janelia.org\s*$,
  category_id: CATEGORY.SCIENCE,
  subcategory_id: SUBCATEGORY.NEUROSCIENCE_COGNITION,
  source: "janelia",
  seeder_score: 0.75,
  maxArticles: 500,
  maxPages: 20,
});
