/**
 * seed-desert-knowledge-au.mjs — Desert Knowledge Australia seeder
 * Category: CATEGORY.PEOPLE_PLACES → SUBCATEGORY.DESERTS_ARID_LANDS
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.dka.com.au",
  cacheFileName: "desert-knowledge-au.json",
  displayName: "🎓 Desert Knowledge Australia",
  feedUrl: "https://www.dka.com.au/feed/",
  articlePathRegex: /(news|projects|about)/,
  siteSuffixRegex: \s*[-–—]\s*dka.com.au\s*$,
  category_id: CATEGORY.PEOPLE_PLACES,
  subcategory_id: SUBCATEGORY.DESERTS_ARID_LANDS,
  source: "desert-knowledge",
  seeder_score: 0.6,
  maxArticles: 500,
  maxPages: 20,
});
