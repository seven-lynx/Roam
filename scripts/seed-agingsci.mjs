/**
 * seed-agingsci.mjs — Aging Sciences seeder
 * Category: CATEGORY.MIND_BODY → SUBCATEGORY.AGING_LONGEVITY
 * Access: Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.agingsci.org",
  cacheFileName: "agingsci.json",
  displayName: "🔬 Aging Sciences",
  
  articlePathRegex: /(news|research|about)/,
  siteSuffixRegex: \s*[-–—]\s*agingsci.org\s*$,
  category_id: CATEGORY.MIND_BODY,
  subcategory_id: SUBCATEGORY.AGING_LONGEVITY,
  source: "agingsci",
  seeder_score: 0.55,
  maxArticles: 500,
  maxPages: 20,
});
