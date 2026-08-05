/**
 * seed-aging-us.mjs — Aging (journal) seeder
 * Category: CATEGORY.MIND_BODY → SUBCATEGORY.AGING_LONGEVITY
 * Access: Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.aging-us.com",
  cacheFileName: "aging-us.json",
  displayName: "📖 Aging (journal)",
  
  articlePathRegex: /(article|review)/,
  siteSuffixRegex: \s*[-–—]\s*aging-us.com\s*$,
  category_id: CATEGORY.MIND_BODY,
  subcategory_id: SUBCATEGORY.AGING_LONGEVITY,
  source: "aging-us",
  seeder_score: 0.75,
  maxArticles: 500,
  maxPages: 20,
});
