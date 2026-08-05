/**
 * seed-longevity-wiki.mjs — Longevity Wiki seeder
 * Category: CATEGORY.MIND_BODY → SUBCATEGORY.AGING_LONGEVITY
 * Access: Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.longevitywiki.org",
  cacheFileName: "longevity-wiki.json",
  displayName: "📚 Longevity Wiki",
  
  articlePathRegex: /(wiki|articles)/,
  siteSuffixRegex: \s*[-–—]\s*longevitywiki.org\s*$,
  category_id: CATEGORY.MIND_BODY,
  subcategory_id: SUBCATEGORY.AGING_LONGEVITY,
  source: "longevity-wiki",
  seeder_score: 0.55,
  maxArticles: 500,
  maxPages: 20,
});
