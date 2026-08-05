/**
 * seed-nps-deserts.mjs — NPS Deserts seeder
 * Category: CATEGORY.PEOPLE_PLACES → SUBCATEGORY.DESERTS_ARID_LANDS
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.nps.gov",
  cacheFileName: "nps-deserts.json",
  displayName: "🏜 NPS Deserts",
  feedUrl: "https://www.nps.gov/subjects/deserts/index.htm",
  articlePathRegex: /(park|place)[a-z-]*/,
  siteSuffixRegex: \s*[-–—]\s*nps.gov\s*$,
  category_id: CATEGORY.PEOPLE_PLACES,
  subcategory_id: SUBCATEGORY.DESERTS_ARID_LANDS,
  source: "nps-deserts",
  seeder_score: 0.75,
  maxArticles: 500,
  maxPages: 20,
});
