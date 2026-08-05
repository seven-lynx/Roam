/**
 * seed-altos-labs.mjs — Altos Labs seeder
 * Category: CATEGORY.MIND_BODY → SUBCATEGORY.AGING_LONGEVITY
 * Access: Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.altoslabs.com",
  cacheFileName: "altos-labs.json",
  displayName: "🧬 Altos Labs",
  
  articlePathRegex: /(science|news|about)/,
  siteSuffixRegex: \s*[-–—]\s*altoslabs.com\s*$,
  category_id: CATEGORY.MIND_BODY,
  subcategory_id: SUBCATEGORY.AGING_LONGEVITY,
  source: "altos-labs",
  seeder_score: 0.65,
  maxArticles: 500,
  maxPages: 20,
});
