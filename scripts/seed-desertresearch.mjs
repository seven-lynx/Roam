/**
 * seed-desertresearch.mjs — Desert Research Institute seeder
 * Category: CATEGORY.PEOPLE_PLACES → SUBCATEGORY.DESERTS_ARID_LANDS
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.dri.edu",
  cacheFileName: "desertresearch.json",
  displayName: "🔬 Desert Research Institute",
  feedUrl: "https://www.dri.edu/feed/",
  articlePathRegex: /(news|research|about)/,
  siteSuffixRegex: \s*[-–—]\s*dri.edu\s*$,
  category_id: CATEGORY.PEOPLE_PLACES,
  subcategory_id: SUBCATEGORY.DESERTS_ARID_LANDS,
  source: "desertresearch",
  seeder_score: 0.75,
  maxArticles: 500,
  maxPages: 20,
});
