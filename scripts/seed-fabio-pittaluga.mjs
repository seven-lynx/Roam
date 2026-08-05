/**
 * seed-fabio-pittaluga.mjs — Fabio Pittaluga seeder
 * Category: CATEGORY.MIND_BODY → SUBCATEGORY.HUMAN_PERFORMANCE
 * Access: Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.fabiopittaluga.com",
  cacheFileName: "fabio-pittaluga.json",
  displayName: "🔬 Fabio Pittaluga",
  
  articlePathRegex: /(blog|about|publications)/,
  siteSuffixRegex: \s*[-–—]\s*fabiopittaluga.com\s*$,
  category_id: CATEGORY.MIND_BODY,
  subcategory_id: SUBCATEGORY.HUMAN_PERFORMANCE,
  source: "fabio-pittaluga",
  seeder_score: 0.5,
  maxArticles: 500,
  maxPages: 20,
});
