/**
 * seed-montereybayaquarium.mjs — Monterey Bay Aquarium seeder
 * Category: CATEGORY.PEOPLE_PLACES → SUBCATEGORY.OCEANS_MARITIME
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.montereybayaquarium.org",
  cacheFileName: "montereybayaquarium.json",
  displayName: "🐟 Monterey Bay Aquarium",
  feedUrl: "https://www.montereybayaquarium.org/feed/",
  articlePathRegex: /(stories|animals|news)/,
  siteSuffixRegex: \s*[-–—]\s*montereybayaquarium.org\s*$,
  category_id: CATEGORY.PEOPLE_PLACES,
  subcategory_id: SUBCATEGORY.OCEANS_MARITIME,
  source: "montereybayaquarium",
  seeder_score: 0.85,
  maxArticles: 500,
  maxPages: 20,
});
