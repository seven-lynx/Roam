/**
 * seed-bna.mjs — BNA seeder
 * Category: CATEGORY.SCIENCE → SUBCATEGORY.NEUROSCIENCE_COGNITION
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.bna.org.uk",
  cacheFileName: "bna.json",
  displayName: "🇬🇧 BNA",
  feedUrl: "https://www.bna.org.uk/feed/",
  articlePathRegex: /(mediacentre|events|news)/,
  siteSuffixRegex: \s*[-–—]\s*bna.org.uk\s*$,
  category_id: CATEGORY.SCIENCE,
  subcategory_id: SUBCATEGORY.NEUROSCIENCE_COGNITION,
  source: "bna",
  seeder_score: 0.65,
  maxArticles: 500,
  maxPages: 20,
});
