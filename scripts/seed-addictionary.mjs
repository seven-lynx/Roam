/**
 * seed-addictionary.mjs — Addictionary seeder
 * Category: CATEGORY.MIND_BODY → SUBCATEGORY.ADDICTION_RECOVERY
 * Access: Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.addictionary.org",
  cacheFileName: "addictionary.json",
  displayName: "📚 Addictionary",
  
  articlePathRegex: /(terms|resources|about)/,
  siteSuffixRegex: \s*[-–—]\s*addictionary.org\s*$,
  category_id: CATEGORY.MIND_BODY,
  subcategory_id: SUBCATEGORY.ADDICTION_RECOVERY,
  source: "addictionary",
  seeder_score: 0.5,
  maxArticles: 500,
  maxPages: 20,
});
