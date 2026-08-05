/**
 * seed-abovetopsecret.mjs — Above Top Secret seeder
 * Category: CATEGORY.WEIRD_WONDERFUL → SUBCATEGORY.FORTEANA_ANOMALIES
 * Access: Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.abovetopsecret.com",
  cacheFileName: "abovetopsecret.json",
  displayName: "🔺 Above Top Secret",
  
  articlePathRegex: /(forum|pages)/,
  siteSuffixRegex: \s*[-–—]\s*abovetopsecret.com\s*$,
  category_id: CATEGORY.WEIRD_WONDERFUL,
  subcategory_id: SUBCATEGORY.FORTEANA_ANOMALIES,
  source: "abovetopsecret",
  seeder_score: 0.55,
  maxArticles: 500,
  maxPages: 20,
});
