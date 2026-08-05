/**
 * seed-sahara-overland.mjs — Sahara Overland seeder
 * Category: CATEGORY.PEOPLE_PLACES → SUBCATEGORY.DESERTS_ARID_LANDS
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.sahara-overland.com",
  cacheFileName: "sahara-overland.json",
  displayName: "🐪 Sahara Overland",
  feedUrl: "https://www.sahara-overland.com/feed/",
  articlePathRegex: /(travelogues|routes|preparation)/,
  siteSuffixRegex: \s*[-–—]\s*sahara-overland.com\s*$,
  category_id: CATEGORY.PEOPLE_PLACES,
  subcategory_id: SUBCATEGORY.DESERTS_ARID_LANDS,
  source: "sahara-overland",
  seeder_score: 0.55,
  maxArticles: 500,
  maxPages: 20,
});
