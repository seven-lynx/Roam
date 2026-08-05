/**
 * seed-sonoraninstitute.mjs — Sonoran Institute seeder
 * Category: CATEGORY.PEOPLE_PLACES → SUBCATEGORY.DESERTS_ARID_LANDS
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "sonoraninstitute.org",
  cacheFileName: "sonoraninstitute.json",
  displayName: "🌵 Sonoran Institute",
  feedUrl: "https://sonoraninstitute.org/feed/",
  articlePathRegex: /(news|projects|resources)/,
  siteSuffixRegex: \s*[-–—]\s*sonoraninstitute.org\s*$,
  category_id: CATEGORY.PEOPLE_PLACES,
  subcategory_id: SUBCATEGORY.DESERTS_ARID_LANDS,
  source: "sonoraninstitute",
  seeder_score: 0.7,
  maxArticles: 500,
  maxPages: 20,
});
