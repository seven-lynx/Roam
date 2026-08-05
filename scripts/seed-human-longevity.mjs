/**
 * seed-human-longevity.mjs — Human Longevity Inc seeder
 * Category: CATEGORY.MIND_BODY → SUBCATEGORY.AGING_LONGEVITY
 * Access: Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.humanlongevity.com",
  cacheFileName: "human-longevity.json",
  displayName: "🧬 Human Longevity Inc",
  
  articlePathRegex: /(news|science|about)/,
  siteSuffixRegex: \s*[-–—]\s*humanlongevity.com\s*$,
  category_id: CATEGORY.MIND_BODY,
  subcategory_id: SUBCATEGORY.AGING_LONGEVITY,
  source: "human-longevity",
  seeder_score: 0.6,
  maxArticles: 500,
  maxPages: 20,
});
