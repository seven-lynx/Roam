/**
 * seed-calico-labs.mjs — Calico Labs seeder
 * Category: CATEGORY.MIND_BODY → SUBCATEGORY.AGING_LONGEVITY
 * Access: Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.calicolabs.com",
  cacheFileName: "calico-labs.json",
  displayName: "🧬 Calico Labs",
  
  articlePathRegex: /(research|news|about)/,
  siteSuffixRegex: \s*[-–—]\s*calicolabs.com\s*$,
  category_id: CATEGORY.MIND_BODY,
  subcategory_id: SUBCATEGORY.AGING_LONGEVITY,
  source: "calico",
  seeder_score: 0.65,
  maxArticles: 500,
  maxPages: 20,
});
